# Quick Task API (Spring Boot + Kotlin)

A task-management backend + lightweight web UI built with **Spring Boot**, **Kotlin**, **PostgreSQL**, **Flyway**, **JWT**, and a **React + Tailwind** SPA served by the backend.

- **UI:** `/app/` (login at `/app/auth`)
- **API:** `/api/v1/*` 

## Features

### Backend
- JWT auth (**access + refresh tokens**) with refresh rotation
- Owner-scoped **Projects (lists)** + **Tasks**
- Global task feed (`/api/v1/tasks`) with **filtering + pagination + sorting**
- Tasks can be **unlisted** (no project/list)
- Moving tasks between lists supported (including moving to **no list**)
- Flyway DB migrations (production-ish setup with `ddl-auto=validate`)
- Swagger UI (OpenAPI)
- Health endpoint + optional Actuator
- Dockerfile + GitHub Actions CI

### Frontend
- React + TypeScript (Vite)
- Tailwind CSS styling
- Multi-screen UI:
  - Login/Register
  - Home task feed with filters + pagination
  - New Task / New List modal windows
  - Row actions menu (Edit/Delete)

## Quickstart (Local)

### 1) Start Postgres

Defaults are in `src/main/resources/application.properties`:
- DB: `task_app_db`
- user: `ryan`
- pass: `password123`

You can override via env vars:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

> Flyway + Hibernate are configured to use schema `tasks`.

If you want to run Postgres via Docker:

```bash
cd docker-compose.yml >/dev/null 2>&1 || true
cd .

docker compose up -d
```

### 2) Run backend

```bash
./gradlew bootRun
```

### 3) Open

- **React UI:** http://localhost:8080/app/
- **Login/Register:** http://localhost:8080/app/auth
- **Swagger UI:** http://localhost:8080/swagger-ui/index.html
- **Demo page:** http://localhost:8080/demo/
- **Health:** http://localhost:8080/actuator/health

## Frontend dev workflow (optional)

You can either:

### Option A (recommended): serve UI from backend
- Build frontend and copy to backend static files (this repo commits a built `/app/` bundle).
- Run backend and open `/app/`.

### Option B: run Vite dev server

Terminal 1:
```bash
./gradlew bootRun
```

Terminal 2:
```bash
cd frontend
npm install
npm run dev
```

Then open the Vite URL (usually http://localhost:5173). The Vite config proxies `/api` + `/actuator` to the backend.

## API

Base path: `/api/v1`

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`

### Projects (Lists)
- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `GET /api/v1/projects/{projectId}`
- `PATCH /api/v1/projects/{projectId}`
- `DELETE /api/v1/projects/{projectId}`

### Tasks (Global feed)
- `POST /api/v1/tasks` *(create task, optionally with `projectId`)*
- `GET /api/v1/tasks` *(list all tasks for the current user)*
- `PATCH /api/v1/tasks/{taskId}`
- `DELETE /api/v1/tasks/{taskId}`

Query params for `GET /api/v1/tasks`:
- `projectId=<uuid>` *(filter tasks in a list)*
- `unlisted=true` *(only tasks with no list)*
- `q` text search
- `status=TODO,IN_PROGRESS` (comma-separated)
- `priority=HIGH`
- `dueBefore` / `dueAfter` (ISO timestamp)
- `completed=true|false`
- `page` / `size` / `sort`

### Tasks (Within a project)
- `POST /api/v1/projects/{projectId}/tasks`
- `GET /api/v1/projects/{projectId}/tasks`
- `GET /api/v1/projects/{projectId}/tasks/{taskId}`
- `PATCH /api/v1/projects/{projectId}/tasks/{taskId}`
- `DELETE /api/v1/projects/{projectId}/tasks/{taskId}`

## Deploy (Render + Neon)

This project is designed to be deployable on free tiers.

### Render
- Create a **Render Web Service** from this repo
- Use the included `Dockerfile`

Env vars:
- `SPRING_PROFILES_ACTIVE=prod`
- `APP_JWT_SECRET` (32+ chars)
- DB settings (either):
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - or set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`

Notes:
- Server port supports Render: `server.port=${PORT:8080}`
- Proxy headers are enabled for hosted deployments.

After deploy:
- UI: `https://<your-service>.onrender.com/app/`
- Swagger: `https://<your-service>.onrender.com/swagger-ui/index.html`
- Health: `https://<your-service>.onrender.com/actuator/health`

### Neon
- Create a Neon Postgres database (free tier)
- Use SSL if required by Neon (common config is `sslmode=require` in the JDBC URL)

## Notes
- Render free services sleep after inactivity (cold start on first request).
- Tasks can be created **without a list**. Deleting a list **does not delete tasks**; tasks become **unlisted**.
