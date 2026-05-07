const connectionStatus = document.getElementById("connectionStatus");
const syncStatus = document.getElementById("syncStatus");
const syncBtn = document.getElementById("syncBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const submitBtn = document.getElementById("submitBtn");
const newAppBtn = document.getElementById("newAppBtn");
const nextStepBtn = document.getElementById("nextStepBtn");
const backStepBtn = document.getElementById("backStepBtn");
const backToDashboardBtn = document.getElementById("backToDashboardBtn");
const appSubtitle = document.getElementById("appSubtitle");
const statusBanner = document.getElementById("statusBanner");

const stepperEl = document.getElementById("stepper");
const tabsEl = document.getElementById("tabs");
const tabPanelEl = document.getElementById("tabPanel");

let activeApplication = null;
let rendered = null;
let saveTimer = null;
let loadedExistingDraft = false;

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

function deriveDisplayId(uuid) {
  if (!uuid) return "---";
  const digits = String(uuid).replace(/\D/g, "");
  if (!digits) {
    let hash = 0;
    for (const ch of uuid) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return String(hash % 1000).padStart(3, "0");
  }
  const tail = digits.slice(-3);
  return tail.padStart(3, "0");
}

function updateAppSubtitle() {
  if (!activeApplication) return;
  const id = deriveDisplayId(activeApplication.id);
  appSubtitle.textContent = `Continue working on application #${id}`;
}

function updateStatusBanner() {
  if (!statusBanner) return;
  if (loadedExistingDraft) {
    statusBanner.textContent = "Editing existing draft application. Form data has been loaded.";
  } else {
    statusBanner.textContent = "New application started. Fill out each tab below.";
  }
  statusBanner.hidden = false;
}

function updateWizardButtons() {
  const step = RenderForm.getStep();
  if (step === 1) {
    backStepBtn.disabled = true;
    nextStepBtn.hidden = false;
    submitBtn.hidden = true;
  } else {
    backStepBtn.disabled = false;
    nextStepBtn.hidden = true;
    submitBtn.hidden = false;
  }
}

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
    loadedExistingDraft = true;
    return apps[0];
  }
  loadedExistingDraft = false;
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

  const focused = (() => {
    const el = document.activeElement;
    if (!el || !el.id) return null;
    // Only attempt restore for form controls we recreate
    const tag = (el.tagName || "").toLowerCase();
    if (tag !== "input" && tag !== "select" && tag !== "textarea") return null;
    let start = null;
    let end = null;
    try {
      if (typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
        start = el.selectionStart;
        end = el.selectionEnd;
      }
    } catch (_) {
      // ignore (some inputs don't support selection ranges)
    }
    return { id: el.id, start, end };
  })();

  rendered = RenderForm.renderApplicationForm({
    schema: window.productSchema,
    state: activeApplication.data,
    mounts: {
      stepper: stepperEl,
      tabs: tabsEl,
      tabPanel: tabPanelEl,
    },
    onChange: (fullKey, value) => {
      FormEngine.setByPath(activeApplication.data, fullKey, value);
      activeApplication.synced = false;
      scheduleSave();
      rerender();
    },
    repeaterHandlers: {
      onAddItem: async () => {
        const items = FormEngine.getByPath(activeApplication.data, "dependants.items") || [];
        const max =
          window.productSchema.sections.find((s) => s.key === "dependants")?.maxItems ?? 29;
        if (items.length >= max) return;
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

  updateWizardButtons();

  if (focused?.id) {
    const nextEl = document.getElementById(focused.id);
    if (nextEl && typeof nextEl.focus === "function") {
      nextEl.focus();
      if (
        focused.start != null &&
        focused.end != null &&
        typeof nextEl.setSelectionRange === "function"
      ) {
        try {
          nextEl.setSelectionRange(focused.start, focused.end);
        } catch (_) {
          // ignore
        }
      }
    }
  }
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
  loadedExistingDraft = false;
  RenderForm.goToStep(1);
  RenderForm.setActiveTab(0);
  await persistActive("manual");
  updateAppSubtitle();
  updateStatusBanner();
  rerender();
  syncStatus.textContent = "New draft created";
});

backToDashboardBtn.addEventListener("click", () => {
  RenderForm.goToStep(1);
  RenderForm.setActiveTab(0);
  updateWizardButtons();
  syncStatus.textContent = "Returned to start of application";
});

nextStepBtn.addEventListener("click", () => {
  if (!rendered) return;
  let result = rendered.validate();
  if (!result.ok) {
    if (result.firstInvalidSectionIdx >= 0) {
      RenderForm.setActiveTab(result.firstInvalidSectionIdx);
      rendered.validate();
    }
    syncStatus.textContent = "Please fix validation errors";
    return;
  }
  RenderForm.goToStep(2);
  updateWizardButtons();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

backStepBtn.addEventListener("click", () => {
  RenderForm.goToStep(1);
  updateWizardButtons();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

submitBtn.addEventListener("click", async () => {
  if (!rendered) return;
  const result = rendered.validate();
  if (!result.ok) {
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
  navigator.serviceWorker
    .register("./service-worker.js")
    .then(() => console.log("Service Worker Registered"));
}

(async function boot() {
  activeApplication = await loadLatestOrNew();
  if (!activeApplication.data) activeApplication.data = {};
  if (!FormEngine.getByPath(activeApplication.data, "dependants.items")) {
    FormEngine.setByPath(activeApplication.data, "dependants.items", []);
  }
  await OfflineDb.saveApplication(activeApplication);
  updateAppSubtitle();
  updateStatusBanner();
  rerender();
})();
