# Timetable Scheduler System

A college timetable scheduling system with two full implementations sharing the same repository history.

---

## Branches

| Branch | Stack | Description |
|--------|-------|-------------|
| `master` | Java · Spring Boot · SQLite (Thymeleaf) | Original standalone desktop-style web app |
| `node-react` | React · Node.js · Express · MongoDB | Full-stack rewrite with REST API, dark/light themes, dynamic scheduling |

---

## `node-react` Branch — React + Node.js + MongoDB

### Features
- 🔐 JWT-based authentication (Admin / Student roles)
- 🏫 Manage Departments, Classes, Teachers, Subjects, Rooms
- 📅 Intelligent timetable generation algorithm (theory spread, lab pairing)
- ⚡ 5-strategy conflict repair algorithm
- 👤 Teacher substitution system
- 🌗 Dark / Light theme toggle
- 📊 Real-world admin dashboard with scheduling coverage metrics
- 📱 Responsive layout

### Tech Stack
```
Frontend   React 19 + Vite + Lucide Icons + React Hot Toast
Backend    Node.js + Express.js
Database   MongoDB (Mongoose ODM)
Auth       JWT (JSON Web Tokens)
```

### Getting Started

**Prerequisites:** Node.js 18+, MongoDB running locally

```bash
# 1. Start the backend
cd server
npm install
node server.js        # runs on http://localhost:5000

# 2. Start the frontend (new terminal)
cd client
npm install
npm run dev           # runs on http://localhost:5173
```

**Default credentials**
```
Admin     username: admin      password: admin123
Student   username: student    password: student123
```

> **Seed data:** Run `node seedData.js` from the `server/` folder to populate the database with sample departments, teachers, subjects, rooms, and time slots.

---

## `master` Branch — Spring Boot (Original)

The original system built with Java Spring Boot, Thymeleaf templates, and an embedded SQLite database. Switch to the `master` branch to access that version.

---

## Repository Structure (`node-react` branch)

```
├── client/          React frontend (Vite)
│   └── src/
│       ├── pages/       Dashboard, Teachers, Classes, Timetable, ...
│       ├── components/  Sidebar, Modal, StatCard, ...
│       ├── context/     AuthContext, ThemeContext
│       └── api/         api.js (Axios client)
├── server/          Node.js backend (Express)
│   ├── models/      Mongoose schemas
│   ├── routes/      REST API routes
│   ├── services/    Timetable scheduling algorithm
│   └── server.js    Entry point
└── README.md
```
