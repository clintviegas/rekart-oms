# Rekart OMS

Order Management System — MongoDB, multi-tenant SaaS-ready.

## Structure

```
Rekart-oms/
├── backend/          # Express API, MongoDB, SMTP, docker-compose
├── frontend/         # Next.js app, Playwright E2E
├── .github/          # CI (GitHub requires this at repo root)
└── README.md
```

## Quick start

### 1. MongoDB

**Docker (from backend folder):**
```bash
cd backend
docker compose up mongo -d
```

**Or** install MongoDB locally on `mongodb://127.0.0.1:27017`

### 2. Env files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` — `MONGODB_URI`, secrets, `STAFF_LOGIN_PASSWORD`, SMTP (optional).

Edit `frontend/.env.local` — `BACKEND_URL=http://localhost:4000`

### 3. Install & run

```bash
cd backend && npm install && npm run dev
```

New terminal:

```bash
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:4000  
- Login: `sales@scalify.ae` / password from `backend/.env`

## Scripts

| Where | Command | Description |
|-------|---------|-------------|
| `backend/` | `npm run dev` | API server |
| `backend/` | `npm test` | API tests |
| `backend/` | `docker compose up --build` | Mongo + full stack |
| `frontend/` | `npm run dev` | Next.js app |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm run test:e2e` | Playwright tests |

## Roles

| Role | Permissions |
|------|-------------|
| admin | Everything + settings + billing |
| sales | Create/edit orders, read products |
| warehouse | Read orders, write inventory |
