---
spec_id: phase-06-docker-infra
status: pending
acceptance_criteria:
  - Backend Dockerfile builds multi-stage image under 200MB
  - Frontend Dockerfile builds multi-stage image with nginx serving SPA
  - nginx.conf proxies /api/ to backend and serves frontend with try_files fallback
  - docker-compose.yml starts postgres + backend + frontend with single "docker compose up"
  - Health checks pass for all services
  - .env.example documents every variable needed by docker-compose
---

# Phase 6: Docker & Infrastructure

## Context Links

- [Plan Overview](plan.md)
- Previous: [Phase 5 - Frontend Modules](phase-05-frontend-modules.md)

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 3h
- **Description**: Multi-stage Dockerfiles for backend and frontend, nginx config for SPA + API proxy, docker-compose.yml orchestrating PostgreSQL + backend + frontend, environment configuration

## Key Insights

- Single docker-compose.yml (no dev/prod split) — use env vars + profiles if needed
- Frontend nginx serves SPA static files + proxies `/api/` to backend container
- Backend connects to postgres via Docker network DNS (`postgres:5432`)
- Multi-stage builds: builder stage compiles TS, runtime stage copies only dist + node_modules (backend) or static files (frontend)
- PostgreSQL data persisted via named volume
- AWS S3 is external — not containerized, only needs env vars

## Requirements

### Functional
- `docker compose up` starts all 3 services (postgres, backend, frontend)
- `docker compose up -d` for detached mode
- Frontend accessible at `http://localhost:80`
- API accessible at `http://localhost:80/api/`
- PostgreSQL accessible at `localhost:5432` for dev tools
- Drizzle migrations run on backend startup or via separate command

### Non-Functional
- Backend image: Node 20 Alpine, < 200MB final
- Frontend image: nginx Alpine, < 50MB final
- PostgreSQL 16 Alpine
- Health checks on all services
- Graceful shutdown support
- Named volume for postgres data persistence

## Architecture

### Service Topology

```
                    ┌─────────────┐
                    │   Client    │
                    │  (Browser)  │
                    └──────┬──────┘
                           │ :80
                    ┌──────▼──────┐
                    │   frontend  │
                    │   (nginx)   │
                    │  SPA + proxy│
                    └──┬───────┬──┘
          /api/*       │       │     /*
          ┌────────────▼┐    ┌▼──────────┐
          │   backend   │    │  Static   │
          │  (Fastify)  │    │  Files    │
          │  :3000      │    │  (React)  │
          └──────┬──────┘    └───────────┘
                 │
          ┌──────▼──────┐
          │  postgres   │
          │  :5432      │
          └─────────────┘

External: AWS S3 (env vars only)
```

### Docker Network

- Single default bridge network created by docker-compose
- Services reference each other by service name: `postgres`, `backend`, `frontend`

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| Create | `backend/Dockerfile` | Multi-stage: build TS + runtime |
| Create | `frontend/Dockerfile` | Multi-stage: build Vite + nginx |
| Create | `frontend/nginx.conf` | SPA routing + /api/ proxy |
| Create | `frontend/.dockerignore` | Exclude node_modules, .git |
| Create | `backend/.dockerignore` | Exclude node_modules, .git |
| Create | `docker-compose.yml` | Orchestrate all services |
| Modify | `.env.example` | Add Docker-specific vars |

## Implementation Steps

### 1. Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
# -- Builder --
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# -- Runtime --
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
```

### 2. Backend .dockerignore (`backend/.dockerignore`)

```
node_modules
dist
.env
*.log
.git
coverage
```

### 3. Frontend nginx.conf (`frontend/nginx.conf`)

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # API proxy
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # File upload support
        client_max_body_size 10M;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Frontend Dockerfile (`frontend/Dockerfile`)

```dockerfile
# -- Builder --
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# -- Runtime --
FROM nginx:1.25-alpine AS runtime

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 5. Frontend .dockerignore (`frontend/.dockerignore`)

```
node_modules
dist
.git
*.log
coverage
```

### 6. docker-compose.yml (root)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-admin}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-crud_admin}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-admin} -d ${DB_NAME:-crud_admin}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER:-admin}:${DB_PASSWORD:-password}@postgres:5432/${DB_NAME:-crud_admin}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      AWS_REGION: ${AWS_REGION}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      S3_BUCKET_NAME: ${S3_BUCKET_NAME}
      PORT: 3000
      FRONTEND_URL: http://localhost
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped

volumes:
  pgdata:
```

### 7. Update .env.example (root)

Add Docker-specific section:
```env
# Database (Docker)
DB_USER=admin
DB_PASSWORD=password
DB_NAME=crud_admin
DATABASE_URL=postgresql://admin:password@localhost:5432/crud_admin

# JWT
JWT_ACCESS_SECRET=change-me-minimum-16-chars
JWT_REFRESH_SECRET=change-me-minimum-16-chars

# AWS S3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name

# App
PORT=3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 8. Database Migration Strategy

Two options for running migrations in Docker:

**Option A (recommended)**: Run migration as part of backend startup
- In `server.ts`, before `app.listen()`:
  ```typescript
  import { migrate } from 'drizzle-orm/postgres-js/migrator';
  await migrate(db, { migrationsFolder: './dist/db/migrations' });
  ```

**Option B**: Separate migration command
- Add script: `"db:migrate:prod": "node dist/db/migrate.js"`
- Run before starting: `docker compose exec backend node dist/db/migrate.js`

### 9. README.md (root)

Create a concise README with:
- Project description (1-2 sentences)
- Prerequisites: Docker, Docker Compose, AWS S3 bucket
- Quick start: `cp .env.example .env` -> edit secrets -> `docker compose up --build`
- Development: instructions for running backend + frontend locally
- API endpoints summary table
- Folder structure overview

## Todo List

- [ ] Create backend Dockerfile (multi-stage)
- [ ] Create backend .dockerignore
- [ ] Create frontend Dockerfile (multi-stage)
- [ ] Create frontend .dockerignore
- [ ] Create frontend nginx.conf (SPA + API proxy)
- [ ] Create docker-compose.yml with all 3 services
- [ ] Update .env.example with all Docker vars
- [ ] Add migration strategy to backend startup
- [ ] Create README.md
- [ ] Test: `docker compose up --build` starts all services
- [ ] Test: frontend loads at localhost:80, API proxied at /api/
- [ ] Test: data persists across `docker compose down` + `up` (pgdata volume)

## Success Criteria

- `docker compose up --build` completes without errors
- All 3 health checks pass (visible via `docker compose ps`)
- `http://localhost` serves React SPA
- `http://localhost/api/health` returns `{ status: 'ok' }` (proxied through nginx)
- PostgreSQL data survives container restart (named volume)
- Backend image < 200MB, frontend image < 50MB (`docker images`)
- `docker compose down && docker compose up` — data still present

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| pnpm not available in node:20-alpine | Medium | Use `corepack enable` in Dockerfile (corepack ships with Node 18+) |
| Migration fails on startup blocking backend | High | Option A: wrap in try-catch with clear error log; Option B: separate command |
| nginx proxy timeout on large file upload | Medium | `client_max_body_size 10M` in nginx.conf |
| PostgreSQL startup slower than backend | Medium | `depends_on: condition: service_healthy` ensures ordering |
| Port 80 already in use on host | Low | Document in README: change port mapping or use `- "8080:80"` |

## Security Considerations

- **Non-root user** in backend Dockerfile (`appuser`)
- **No secrets in Dockerfile** — all via environment variables at runtime
- **PostgreSQL not exposed in production** — remove `ports: - "5432:5432"` mapping for prod (keep for dev convenience)
- **.env never committed** — only `.env.example` in git
- **nginx**: no server version disclosure (Alpine nginx default hides it)
- **Health check endpoints** return minimal info — no internal state exposure
- **HTTPS**: not handled in docker-compose (expected: reverse proxy or cloud load balancer in front)
- **Docker image pinning**: pin to specific Alpine versions for reproducibility

## Next Steps

- After all phases complete: end-to-end testing, code review, documentation finalization
- Production deployment considerations (beyond scope): HTTPS termination, CI/CD pipeline, monitoring, log aggregation
