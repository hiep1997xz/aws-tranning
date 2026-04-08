# CRUD Admin Management Platform

A fullstack admin dashboard for managing users, categories, and products with file uploads to AWS S3. Built with Fastify, React, TypeScript, and PostgreSQL.

## Features

- **Authentication**: JWT-based auth with httpOnly cookies, refresh token rotation
- **User Management**: Full CRUD with avatar upload to S3
- **Categories**: Full CRUD with JSON storage
- **Products**: Full CRUD with category association and image upload to S3
- **Responsive UI**: React 18 + Ant Design v6 + TailwindCSS
- **Docker Ready**: Single `docker-compose` deployment

## Prerequisites

- **Local Development**: Node.js 20+, npm 10+
- **PostgreSQL**: 16+ (local or Docker)
- **AWS S3**: Valid bucket and credentials
- **Docker** (optional, for containerized deployment)

## Quick Start — Local Development

### 1. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) for details.

### 3. Database Setup

Run migrations in the backend:

```bash
cd backend
npm run db:generate  # Generate migration files (if schema changed)
npm run db:migrate   # Apply migrations to PostgreSQL
```

### 4. Start Backend

```bash
cd backend
npm run dev         # Runs on http://localhost:3000
```

### 5. Start Frontend

In another terminal:

```bash
cd frontend
npm run dev         # Runs on http://localhost:5173
```

### 6. Login

Visit `http://localhost:5173/login` — use an existing user or create one via API.

## Docker Deployment

### Build & Run

```bash
docker-compose up -d
```

Services:
- **Frontend**: http://localhost (nginx on port 80)
- **Backend**: http://localhost/api/* (proxied)
- **PostgreSQL**: Internal, port 5432

### First-Time Setup in Docker

```bash
# Wait for services to start, then run migrations
docker-compose exec backend npm run db:migrate
```

## API Endpoints

All endpoints return JSON. Authentication required except for `/api/auth/login`.

### Auth
- `POST /api/auth/login` — `{ email, password }` → sets httpOnly cookies
- `POST /api/auth/refresh` — refreshes access token using refresh cookie
- `POST /api/auth/logout` — clears cookies
- `GET /api/auth/me` — current user profile

### Users
- `GET /api/users` — list all users
- `GET /api/users/:id` — get user by ID
- `POST /api/users` — multipart (email, password, name, avatar?) → create
- `PUT /api/users/:id` — multipart (name?, email?, password?, avatar?) → update
- `DELETE /api/users/:id` — delete user

### Categories
- `GET /api/categories` — list all
- `GET /api/categories/:id` — get by ID
- `POST /api/categories` — `{ name, description? }` → create
- `PUT /api/categories/:id` — `{ name?, description? }` → update
- `DELETE /api/categories/:id` — delete

### Products
- `GET /api/products` — list all with category details
- `GET /api/products/:id` — get by ID
- `POST /api/products` — multipart (name, categoryId, price, image?) → create
- `PUT /api/products/:id` — multipart (name?, categoryId?, price?, image?) → update
- `DELETE /api/products/:id` — delete

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://admin:pass@localhost:5432/crud_admin` |
| `JWT_ACCESS_SECRET` | Yes | Secret for access tokens (min 32 chars) | Random string, min 32 chars |
| `JWT_REFRESH_SECRET` | Yes | Secret for refresh tokens (min 32 chars) | Random string, min 32 chars |
| `AWS_REGION` | Yes | AWS region for S3 | `ap-southeast-1` |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key | From AWS Console |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key | From AWS Console |
| `S3_BUCKET_NAME` | Yes | S3 bucket name | Your bucket name |
| `FRONTEND_URL` | Yes | Frontend origin for CORS | `http://localhost:5173` (dev), `https://yourdomain.com` (prod) |
| `PORT` | No | Backend port (default: 3000) | 3000 |
| `NODE_ENV` | No | Environment mode | `development` or `production` |

See `.env.example` for defaults.

## File Structure

```
.
├── backend/              # Fastify + TypeScript
│   ├── src/
│   │   ├── config/       # env, db, s3 clients
│   │   ├── db/schema/    # Drizzle ORM schemas (users, products, etc.)
│   │   ├── lib/          # token.ts, s3-upload.ts
│   │   ├── middleware/   # authenticate, validate, error-handler
│   │   ├── modules/      # auth, users, categories, products
│   │   ├── app.ts        # Fastify app setup
│   │   └── server.ts     # Server startup
│   ├── Dockerfile
│   └── package.json
├── frontend/             # React 18 + Vite
│   ├── src/
│   │   ├── components/   # Layout, pages (handled via router)
│   │   ├── lib/          # axios interceptor
│   │   ├── pages/        # login, dashboard, users, products, categories
│   │   ├── router/       # react-router setup
│   │   ├── store/        # Zustand auth store
│   │   ├── types/        # API types
│   │   └── App.tsx
│   ├── Dockerfile
│   ├── nginx.conf        # For Docker deployment
│   └── package.json
├── docker-compose.yml    # Multi-container setup
├── .env.example
└── docs/                 # This documentation
```

## Troubleshooting

### Cannot connect to PostgreSQL
- Verify `DATABASE_URL` in `.env`
- Check PostgreSQL is running: `psql postgres://...`
- In Docker: wait 10s after `docker-compose up` for postgres to be ready

### 401 Unauthorized on API calls
- Check access token in cookie: open DevTools → Application → Cookies → `access_token`
- Manually refresh: `POST http://localhost:3000/api/auth/refresh`
- If expired, login again

### S3 Upload fails
- Verify AWS credentials in `.env`
- Check bucket exists and policy allows `PutObject`, `GetObject`, `DeleteObject`
- Bucket region must match `AWS_REGION`

### Frontend not updating after API call
- Check TanStack Query is refetching: open DevTools → Network
- Clear browser cache if stale data persists
- Verify Zustand auth store via `localStorage` (key: `auth-storage`)

## Documentation

- [System Architecture](system-architecture.md) — Component diagram, data flows, networking
- [Code Standards](code-standards.md) — Naming, patterns, TypeScript, error handling
- [Deployment Guide](deployment-guide.md) — Production setup, migrations, scaling
