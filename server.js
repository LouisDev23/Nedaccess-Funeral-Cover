const express = require("express");
const sql = require("mssql");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

function getSqlConfig() {
  const server = process.env.AZURE_SQL_SERVER;
  const database = process.env.AZURE_SQL_DATABASE;
  const user = process.env.AZURE_SQL_USER;
  const password = process.env.AZURE_SQL_PASSWORD;

  if (!server || !database || !user || !password) {
    throw new Error(
      "Missing Azure SQL env vars. Set AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD."
    );
  }

  return {
    user,
    password,
    server,
    database,
    options: {
      encrypt: (process.env.AZURE_SQL_ENCRYPT || "true") === "true",
      trustServerCertificate:
        (process.env.AZURE_SQL_TRUST_SERVER_CERT || "false") === "true",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

let poolPromise = null;
async function getPool() {
  if (!poolPromise) {
    const cfg = getSqlConfig();
    poolPromise = sql.connect(cfg);
  }
  return poolPromise;
}

async function ensureSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.Applications', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Applications (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        productKey NVARCHAR(100) NOT NULL,
        version INT NOT NULL,
        state NVARCHAR(32) NOT NULL,
        createdAt DATETIME2 NOT NULL,
        updatedAt DATETIME2 NOT NULL,
        dataJson NVARCHAR(MAX) NOT NULL
      );
    END
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.Dependants', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Dependants (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        applicationId UNIQUEIDENTIFIER NOT NULL,
        dataJson NVARCHAR(MAX) NOT NULL,
        CONSTRAINT FK_Dependants_Applications
          FOREIGN KEY (applicationId) REFERENCES dbo.Applications(id)
          ON DELETE CASCADE
      );
    END
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.Documents', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Documents (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        applicationId UNIQUEIDENTIFIER NOT NULL,
        documentKey NVARCHAR(100) NOT NULL,
        fileName NVARCHAR(512) NULL,
        contentType NVARCHAR(128) NULL,
        fileSize INT NULL,
        selectedAt DATETIME2 NULL,
        CONSTRAINT FK_Documents_Applications
          FOREIGN KEY (applicationId) REFERENCES dbo.Applications(id)
          ON DELETE CASCADE
      );
    END
  `);
}

function toDateOrNow(iso) {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

app.get("/api/health", async (req, res) => {
  try {
    await ensureSchema();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/applications", async (req, res) => {
  try {
    await ensureSchema();
    const pool = await getPool();

    const { id, productKey, version, state, createdAt, updatedAt, data } =
      req.body || {};
    if (!id || !productKey || !version || !state || !data) {
      return res.status(400).json({ ok: false, error: "Missing fields." });
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const dataJson = JSON.stringify(data);
      const created = toDateOrNow(createdAt);
      const updated = toDateOrNow(updatedAt);

      await new sql.Request(tx)
        .input("id", sql.UniqueIdentifier, id)
        .input("productKey", sql.NVarChar(100), String(productKey))
        .input("version", sql.Int, Number(version))
        .input("state", sql.NVarChar(32), String(state))
        .input("createdAt", sql.DateTime2, created)
        .input("updatedAt", sql.DateTime2, updated)
        .input("dataJson", sql.NVarChar(sql.MAX), dataJson)
        .query(`
          MERGE dbo.Applications WITH (HOLDLOCK) AS target
          USING (SELECT @id AS id) AS src
          ON (target.id = src.id)
          WHEN MATCHED THEN
            UPDATE SET productKey=@productKey, version=@version, state=@state, createdAt=@createdAt, updatedAt=@updatedAt, dataJson=@dataJson
          WHEN NOT MATCHED THEN
            INSERT (id, productKey, version, state, createdAt, updatedAt, dataJson)
            VALUES (@id, @productKey, @version, @state, @createdAt, @updatedAt, @dataJson);
        `);

      // Dependants: replace for simplicity
      await new sql.Request(tx)
        .input("applicationId", sql.UniqueIdentifier, id)
        .query(`DELETE FROM dbo.Dependants WHERE applicationId = @applicationId`);

      const dependants = data?.dependants?.items || [];
      for (const dep of dependants) {
        const depId = dep?.id ? dep.id : cryptoRandomUuid();
        await new sql.Request(tx)
          .input("id", sql.UniqueIdentifier, depId)
          .input("applicationId", sql.UniqueIdentifier, id)
          .input("dataJson", sql.NVarChar(sql.MAX), JSON.stringify(dep || {}))
          .query(
            `INSERT INTO dbo.Dependants (id, applicationId, dataJson) VALUES (@id, @applicationId, @dataJson)`
          );
      }

      // Documents: replace for simplicity
      await new sql.Request(tx)
        .input("applicationId", sql.UniqueIdentifier, id)
        .query(`DELETE FROM dbo.Documents WHERE applicationId = @applicationId`);

      const docs = data?.documents || {};
      for (const [docKey, meta] of Object.entries(docs)) {
        const m = meta || {};
        await new sql.Request(tx)
          .input("id", sql.UniqueIdentifier, cryptoRandomUuid())
          .input("applicationId", sql.UniqueIdentifier, id)
          .input("documentKey", sql.NVarChar(100), String(docKey))
          .input("fileName", sql.NVarChar(512), m.fileName ? String(m.fileName) : null)
          .input("contentType", sql.NVarChar(128), m.type ? String(m.type) : null)
          .input("fileSize", sql.Int, m.size != null ? Number(m.size) : null)
          .input(
            "selectedAt",
            sql.DateTime2,
            m.selectedAt ? toDateOrNow(m.selectedAt) : null
          )
          .query(
            `INSERT INTO dbo.Documents (id, applicationId, documentKey, fileName, contentType, fileSize, selectedAt)
             VALUES (@id, @applicationId, @documentKey, @fileName, @contentType, @fileSize, @selectedAt)`
          );
      }

      await tx.commit();
      res.json({ ok: true });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/applications", async (req, res) => {
  try {
    await ensureSchema();
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 100 id, productKey, version, state, createdAt, updatedAt
      FROM dbo.Applications
      ORDER BY updatedAt DESC
    `);
    res.json(result.recordset || []);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/applications/:id", async (req, res) => {
  try {
    await ensureSchema();
    const pool = await getPool();
    const id = req.params.id;

    const appRow = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(
        `SELECT id, productKey, version, state, createdAt, updatedAt, dataJson FROM dbo.Applications WHERE id=@id`
      );
    if (!appRow.recordset?.[0]) return res.status(404).json({ ok: false, error: "Not found" });

    const deps = await pool
      .request()
      .input("applicationId", sql.UniqueIdentifier, id)
      .query(`SELECT dataJson FROM dbo.Dependants WHERE applicationId=@applicationId`);

    const docs = await pool
      .request()
      .input("applicationId", sql.UniqueIdentifier, id)
      .query(
        `SELECT documentKey, fileName, contentType, fileSize, selectedAt FROM dbo.Documents WHERE applicationId=@applicationId`
      );

    const appRec = appRow.recordset[0];
    const data = JSON.parse(appRec.dataJson);
    data.dependants = data.dependants || {};
    data.dependants.items = (deps.recordset || []).map((r) => JSON.parse(r.dataJson));
    data.documents = {};
    for (const d of docs.recordset || []) {
      data.documents[d.documentKey] = {
        fileName: d.fileName,
        type: d.contentType,
        size: d.fileSize,
        selectedAt: d.selectedAt ? new Date(d.selectedAt).toISOString() : null,
      };
    }

    res.json({
      id: appRec.id,
      productKey: appRec.productKey,
      version: appRec.version,
      state: appRec.state,
      createdAt: appRec.createdAt,
      updatedAt: appRec.updatedAt,
      data,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function cryptoRandomUuid() {
  // Simple UUIDv4 generator (Node 18+ also has crypto.randomUUID, but keep local)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
