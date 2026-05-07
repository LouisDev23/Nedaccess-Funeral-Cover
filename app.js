const form = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const connectionStatus = document.getElementById('connectionStatus');
const syncStatus = document.getElementById('syncStatus');
const syncBtn = document.getElementById('syncBtn');

function updateConnectionStatus() {
  if (navigator.onLine) {
    connectionStatus.innerHTML = '🟢 Online';
    syncStatus.innerHTML = 'Sync Available';
    syncPendingTasks();
  } else {
    connectionStatus.innerHTML = '🔴 Offline';
    syncStatus.innerHTML = 'Offline Mode';
  }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

updateConnectionStatus();

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const task = {
    id: crypto.randomUUID(),
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    createdAt: new Date().toISOString(),
    synced: false
  };

  await saveTask(task);

  renderTasks();

  form.reset();

  if (navigator.onLine) {
    syncPendingTasks();
  }
});

async function renderTasks() {
  const tasks = await getTasks();

  taskList.innerHTML = '';

  tasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  tasks.forEach(task => {
    const div = document.createElement('div');

    div.className = `task ${task.synced ? 'synced' : 'pending'}`;

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description}</p>
      <div class="small">${task.createdAt}</div>
      <div class="small">${task.synced ? 'Synced to DB' : 'Pending Sync'}</div>
    `;

    taskList.appendChild(div);
  });
}

async function uploadTask(task) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(task)
  });

  return response.json();
}

async function syncPendingTasks() {
  if (!navigator.onLine) return;

  syncStatus.innerHTML = 'Syncing...';

  const tasks = await getTasks();

  for (const task of tasks) {
    if (!task.synced) {
      try {
        await uploadTask(task);

        task.synced = true;

        await saveTask(task);
      } catch (err) {
        console.error(err);
      }
    }
  }

  syncStatus.innerHTML = 'All Synced';

  renderTasks();
}

syncBtn.addEventListener('click', syncPendingTasks);

renderTasks();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(() => console.log('Service Worker Registered'));
}
