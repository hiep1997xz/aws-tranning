---
title: "CRUD Admin Management System"
description: "Fullstack admin panel with User/Product/Category CRUD, JWT auth, S3 uploads, Docker deployment"
status: pending
priority: P1
effort: 32h
branch: main
tags: [fullstack, backend, frontend, auth, docker, typescript]
created: 2026-04-08
test_framework: "vitest"
test_flags: ["--run"]
---

# CRUD Admin Management System

## Overview

Fullstack CRUD admin panel: Fastify + Drizzle ORM backend, React + Ant Design frontend, PostgreSQL, JWT httpOnly cookie auth, AWS S3 image uploads, Docker deployment with nginx reverse proxy.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Project Setup | Pending | 3h | [phase-01](phase-01-project-setup.md) |
| 2 | Backend Core | Pending | 6h | [phase-02](phase-02-backend-core.md) |
| 3 | Backend Modules | Pending | 8h | [phase-03](phase-03-backend-modules.md) |
| 4 | Frontend Core | Pending | 5h | [phase-04](phase-04-frontend-core.md) |
| 5 | Frontend Modules | Pending | 7h | [phase-05](phase-05-frontend-modules.md) |
| 6 | Docker & Infrastructure | Pending | 3h | [phase-06](phase-06-docker-infra.md) |

## Dependencies

- PostgreSQL 16 (Docker container)
- AWS S3 bucket + IAM credentials (external)
- Node.js 20 LTS
- pnpm (package manager)

## Test Strategy

- **Backend**: Vitest for unit tests on services/utils, Supertest for route integration tests
- **Frontend**: Vitest + React Testing Library for component/hook tests
- **E2E**: Manual verification per phase; Playwright optional stretch goal
- **Coverage target**: 80%+ business logic (services, hooks, stores)

## Architecture Decisions

1. Monorepo with `backend/` + `frontend/` — no workspace tooling (KISS)
2. JWT access token (15m) in httpOnly cookie + refresh token (7d) hashed in DB
3. S3 keys stored in DB, pre-signed URLs generated at read time
4. Single docker-compose.yml with multi-stage Dockerfiles
5. TailwindCSS + antd coexistence via `@layer` + `StyleProvider`
6. Antd Form for all CRUD forms (native integration, no RHF)
7. Axios 401 interceptor with refresh-token retry queue
