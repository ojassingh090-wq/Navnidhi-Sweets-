# 🍬 Navnidhi Sweets — Local Setup Guide

Run the full app (React + FastAPI + MongoDB) on your own computer.

---

## 1. Prerequisites

Install these first:

- **Node.js** 18+ and **Yarn** — https://nodejs.org / `npm install -g yarn`
- **Python** 3.10+ — https://python.org
- **MongoDB** (Community Server) — https://www.mongodb.com/try/download/community
  - Or use free cloud MongoDB Atlas: https://www.mongodb.com/atlas

Make sure MongoDB is running locally (default: `mongodb://localhost:27017`).

---

## 2. Get the code

Clone your GitHub repository:

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

---

## 3. Backend setup (FastAPI)

```bash
cd backend

# (Recommended) create a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Create `backend/.env`
Copy the example and edit values:

```bash
cp .env.example .env
```

Contents (edit as needed):

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="navnidhi_sweets"
CORS_ORIGINS="http://localhost:3000"
JWT_SECRET="change-this-to-a-random-64-char-hex-string"
ADMIN_EMAIL="admin@navnidhisweets.com"
ADMIN_PASSWORD="Purity@Navnidhi108"
STORAGE_BACKEND="local"
EMERGENT_LLM_KEY=""
APP_NAME="navnidhi-sweets"
```

> **Image uploads:** `STORAGE_BACKEND="local"` saves uploaded photos to `backend/uploads/` on your disk — **no Emergent key needed**. (If you set it to `"emergent"`, you must provide a valid `EMERGENT_LLM_KEY`.)

### Run the backend

```bash
uvicorn server:app --reload --port 8001
```

Backend runs at http://localhost:8001. On first start it auto-seeds the admin user and product menu.

---

## 4. Frontend setup (React)

Open a **new terminal**:

```bash
cd frontend
yarn install
```

### Create `frontend/.env`

```bash
cp .env.example .env
```

Contents:

```
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Run the frontend

```bash
yarn start
```

App opens at http://localhost:3000 🎉

---

## 5. Admin login

- URL: scroll to the footer → **"Secure Login"**
- Email: `admin@navnidhisweets.com`
- Password: `Purity@Navnidhi108`

From **Admin → Settings** you can change the password and WhatsApp/contact number.
From **Admin → Branding** you can upload the logo and hero banner.

---

## 6. Common issues

| Problem | Fix |
|--------|-----|
| `pymongo`/connection error | Make sure MongoDB is running; check `MONGO_URL`. |
| CORS error in browser | Ensure `CORS_ORIGINS` includes `http://localhost:3000` and restart backend. |
| Uploaded images 404 | Confirm `STORAGE_BACKEND="local"`; images are stored in `backend/uploads/`. |
| `yarn: command not found` | `npm install -g yarn`. |
| Port already in use | Change the port (e.g. `--port 8002`) and update `REACT_APP_BACKEND_URL`. |

---

## Tech stack

- **Frontend:** React, Tailwind CSS, shadcn/ui, Axios
- **Backend:** FastAPI, Motor (async MongoDB), PyJWT, bcrypt
- **Database:** MongoDB
