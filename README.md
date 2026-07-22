# Baby Tracker

A full-stack baby tracking app for logging feedings (breastfeed, pumped, formula) and diaper changes (pee, poop). Each user gets their own account with isolated data.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT tokens + bcrypt password hashing

## Getting Started

### Install dependencies

```bash
npm run install:all
```

### Run in development mode

In two separate terminals:

```bash
# Terminal 1 — backend (port 3001)
npm run dev:server

# Terminal 2 — frontend (port 5173)
npm run dev:client
```

Open http://localhost:5173 in your browser.

### Production build

```bash
npm run build:client
npm start
```

Then open http://localhost:3001.

## Features

- User registration and login
- Multiple baby profiles per user
- Feeding tracking:
  - Breastfeed (duration in minutes, side)
  - Pumped milk (quantity in ml/oz)
  - Formula (quantity in ml/oz)
- Diaper tracking (pee, poop, both)
- Data isolation per user account
