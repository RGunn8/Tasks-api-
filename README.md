# Tasks API (Spring Boot + Kotlin)

A task management backend API built with **Spring Boot**, **Kotlin**, **PostgreSQL**, **Flyway**, and **JWT**.

## Features

- JWT auth (**access + refresh tokens**) with refresh rotation
- Projects + Tasks (owner-scoped)
- Task list filtering + pagination + sorting
- Flyway DB migrations
- Swagger UI (OpenAPI)
- Static demo page served by the backend
- GitHub Actions CI

## Quickstart (Local)

### 1) Configure Postgres

This project expects a Postgres database and credentials. Defaults are set in `application.properties`:

- DB: `task_app_db`
- user: `ryan`
- pass: `password123`

You can override via env vars:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

> Note: Flyway + Hibernate are configured to use schema `tasks`.

### 2) Run

```bash
./gradlew bootRun
```

### 3) Open

- Swagger UI: http://localhost:8080/swagger-ui/index.html
- Demo page: http://localhost:8080/demo/
- Health: http://localhost:8080/actuator/health

## API

Base path: `/api/v1`

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`

### Projects
- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `GET /api/v1/projects/{projectId}`
- `PATCH /api/v1/projects/{projectId}`
- `DELETE /api/v1/projects/{projectId}`

### Tasks
- `POST /api/v1/projects/{projectId}/tasks`
- `GET /api/v1/projects/{projectId}/tasks`
- `GET /api/v1/projects/{projectId}/tasks/{taskId}`
- `PATCH /api/v1/projects/{projectId}/tasks/{taskId}`
- `DELETE /api/v1/projects/{projectId}/tasks/{taskId}`

Task list query params:
- `q` text search
- `status=TODO,IN_PROGRESS`
- `priority=HIGH`
- `dueBefore` / `dueAfter` (ISO timestamp)
- `completed=true|false`
- `page` / `size` / `sort`

## Deploy (Render + Neon)

- Create a **Neon** Postgres database (free tier) and copy the connection values.
- Create a **Render** Web Service (free tier) using this repo.
- Use the included `Dockerfile`.

Set env vars in Render:
- `SPRING_PROFILES_ACTIVE=prod`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `APP_JWT_SECRET` (32+ chars)

After deploy:
- Swagger: `https://<your-service>.onrender.com/swagger-ui/index.html`
- Demo: `https://<your-service>.onrender.com/demo/`

## Notes

- Render free services sleep after ~15 minutes of inactivity (cold start ~1 minute).
