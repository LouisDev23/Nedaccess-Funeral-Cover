# Offline PWA Full Stack Demo

This project includes:

- Offline-first PWA
- IndexedDB local storage
- Auto-sync system
- SQLite database backend
- Express API
- Persistent offline queue
- Database viewer page

---

# INSTALL

npm install

---

# RUN

npm start

---

# OPEN APP

http://localhost:3000

---

# VIEW DATABASE

http://localhost:3000/view-database.html

---

# TEST OFFLINE MODE

1. Open website online once
2. Press F12
3. Network tab
4. Enable Offline
5. Create tasks
6. Close browser
7. Reopen browser
8. Tasks still exist locally

---

# TEST SYNC

1. Turn internet back on
2. Tasks sync automatically
3. Open:

http://localhost:3000/view-database.html

4. View synced records from SQLite database

---

# DATABASE

SQLite file:

tasks.db

Automatically created after first sync.

---

# IMPORTANT

This version uses:

Frontend:
- PWA
- Service Worker
- IndexedDB

Backend:
- Node.js
- Express
- SQLite

---

# PRODUCTION UPGRADE IDEAS

- SQL Server
- PostgreSQL
- JWT Authentication
- Background Sync API
- Conflict Resolution
- Encryption
