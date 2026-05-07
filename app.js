const connectionStatus = document.getElementById("connectionStatus");
const syncStatus = document.getElementById("syncStatus");
const syncBtn = document.getElementById("syncBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const submitBtn = document.getElementById("submitBtn");
const newAppBtn = document.getElementById("newAppBtn");
const mount = document.getElementById("formMount");

let activeApplication = null;
let rendered = null;
let saveTimer = null;

function updateConnectionStatus() {
  if (navigator.onLine) {
    connectionStatus.textContent = "Online";
    syncStatus.textContent = "Sync available";
    syncPendingApplications();
  } else {
    connectionStatus.textContent = "Offline";
    syncStatus.textContent = "Offline mode";
  }
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

function buildNewApplication() {
  const now = new Date().toISOString();
  const schema = window.productSchema;

  const data = {
    setup_plan: {
      education_consent: true,
      education_consent_at: now,
    },
    dependants: { items: [] },
    review_quote: {
      policy_name: schema?.title || "MyCover Funeral",
      digital_discount: "5%",
      client_discount: "5%",
    },
    documents: {},
    terms: {},
  };

  // Set defaults declared on schema fields
  for (const section of schema.sections || []) {
    if (section.type === "repeater") continue;
    for (const field of section.fields || []) {
      const key = `${section.key}.${field.key}`;
      if (field.defaultValue !== undefined) FormEngine.setByPath(data, key, field.defaultValue);
    }
  }

  FormEngine.computeDerivedFields(schema, data);

  return {
    id: crypto.randomUUID(),
    productKey: schema.productKey,
    version: schema.version,
    state: schema.workflow?.initial || "APPLICATION",
    createdAt: now,
    updatedAt: now,
    synced: false,
    lastSyncAt: null,
    data,
  };
}

async function loadLatestOrNew() {
  const apps = await OfflineDb.getApplications();
  if (apps && apps.length > 0) {
    apps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return apps[0];
  }
  return buildNewApplication();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistActive("auto");
  }, 350);
}

async function persistActive(reason) {
  if (!activeApplication) return;
  activeApplication.updatedAt = new Date().toISOString();
  await OfflineDb.saveApplication(activeApplication);
  if (reason !== "auto") syncStatus.textContent = "Draft saved";
}

function rerender() {
  if (!activeApplication) return;
  FormEngine.computeDerivedFields(window.productSchema, activeApplication.data);

  rendered = RenderForm.renderApplicationForm({
    schema: window.productSchema,
    state: activeApplication.data,
    mount,
    onChange: (fullKey, value) => {
      FormEngine.setByPath(activeApplication.data, fullKey, value);
      activeApplication.synced = false;
      scheduleSave();
      rerender();
    },
    repeaterHandlers: {
      onAddItem: async () => {
        const items = FormEngine.getByPath(activeApplication.data, "dependants.items") || [];
        if (items.length >= (window.productSchema.sections.find((s) => s.key === "dependants")?.maxItems ?? 29)) return;
        items.push({});
        FormEngine.setByPath(activeApplication.data, "dependants.items", items);
        activeApplication.synced = false;
        await persistActive("manual");
        rerender();
      },
      onRemoveItem: async (idx) => {
        const items = FormEngine.getByPath(activeApplication.data, "dependants.items") || [];
        items.splice(idx, 1);
        FormEngine.setByPath(activeApplication.data, "dependants.items", items);
        activeApplication.synced = false;
        await persistActive("manual");
        rerender();
      },
    },
  });
}

async function uploadApplication(application) {
  const payload = {
    id: application.id,
    productKey: application.productKey,
    version: application.version,
    state: application.state,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    data: application.data,
  };

  const response = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Upload failed");
  }

  return response.json();
}

async function syncPendingApplications() {
  if (!navigator.onLine) return;

  syncStatus.textContent = "Syncing...";

  const apps = await OfflineDb.getApplications();
  apps.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));

  let syncedCount = 0;
  for (const app of apps) {
    if (!app.synced) {
      try {
        await uploadApplication(app);
        app.synced = true;
        app.lastSyncAt = new Date().toISOString();
        await OfflineDb.saveApplication(app);
        syncedCount++;
      } catch (err) {
        console.error(err);
      }
    }
  }

  syncStatus.textContent = syncedCount > 0 ? `Synced ${syncedCount}` : "All synced";
}

saveDraftBtn.addEventListener("click", () => persistActive("manual"));
syncBtn.addEventListener("click", () => syncPendingApplications());

newAppBtn.addEventListener("click", async () => {
  activeApplication = buildNewApplication();
  await persistActive("manual");
  rerender();
  syncStatus.textContent = "New draft created";
});

submitBtn.addEventListener("click", async () => {
  if (!rendered) return;
  const ok = rendered.validate();
  if (!ok) {
    syncStatus.textContent = "Please fix validation errors";
    return;
  }

  activeApplication.state = "SUBMITTED";
  activeApplication.synced = false;
  await persistActive("manual");
  syncStatus.textContent = "Submitted (pending sync)";
  if (navigator.onLine) syncPendingApplications();
});

updateConnectionStatus();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").then(() => console.log("Service Worker Registered"));
}

(async function boot() {
  activeApplication = await loadLatestOrNew();
  // Ensure shape
  if (!activeApplication.data) activeApplication.data = {};
  if (!FormEngine.getByPath(activeApplication.data, "dependants.items")) FormEngine.setByPath(activeApplication.data, "dependants.items", []);
  await OfflineDb.saveApplication(activeApplication);
  rerender();
})();
