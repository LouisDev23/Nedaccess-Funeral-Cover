const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./tasks.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      createdAt TEXT
    )
  `);
});

app.post('/api/tasks', (req, res) => {
  const task = req.body;

  db.run(
    `INSERT OR REPLACE INTO tasks (id, title, description, createdAt)
     VALUES (?, ?, ?, ?)`,
    [task.id, task.title, task.description, task.createdAt],
    (err) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          success: false
        });
      }

      console.log('Saved to database:', task.title);

      res.json({
        success: true
      });
    }
  );
});

app.get('/api/tasks', (req, res) => {
  db.all(`SELECT * FROM tasks ORDER BY createdAt DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false
      });
    }

    res.json(rows);
  });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
