const DB_NAME = 'offline-pwa-db';
const STORE_TASKS = 'tasks';
const STORE_APPLICATIONS = 'applications';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(STORE_APPLICATIONS)) {
        db.createObjectStore(STORE_APPLICATIONS, {
          keyPath: 'id'
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Legacy task helpers kept (not used by new demo UI)
async function saveTask(task) {
  const db = await openDB();

  const tx = db.transaction(STORE_TASKS, 'readwrite');
  const store = tx.objectStore(STORE_TASKS);

  store.put(task);
}

async function getTasks() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TASKS, 'readonly');
    const store = tx.objectStore(STORE_TASKS);

    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveApplication(application) {
  const db = await openDB();
  const tx = db.transaction(STORE_APPLICATIONS, 'readwrite');
  const store = tx.objectStore(STORE_APPLICATIONS);
  store.put(application);
}

async function getApplication(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APPLICATIONS, 'readonly');
    const store = tx.objectStore(STORE_APPLICATIONS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getApplications() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APPLICATIONS, 'readonly');
    const store = tx.objectStore(STORE_APPLICATIONS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteApplication(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_APPLICATIONS, 'readwrite');
  const store = tx.objectStore(STORE_APPLICATIONS);
  store.delete(id);
}

window.OfflineDb = {
  saveApplication,
  getApplication,
  getApplications,
  deleteApplication,
  // legacy
  saveTask,
  getTasks,
};
