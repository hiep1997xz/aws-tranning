---
spec_id: phase-02-backend-core
status: pending
acceptance_criteria:
  - Drizzle schema defines users, refresh_tokens, products, categories tables
  - drizzle-kit migration generates and applies cleanly to PostgreSQL
  - JWT sign/verify helpers work with httpOnly cookies
  - Auth middleware rejects requests without valid access token
  - Zod-based env config validation runs at startup
  - Global error handler returns structured JSON errors
---

# Phase 2: Backend Core

## Context Links

- [Plan Overview](plan.md)
- Previous: [Phase 1 - Project Setup](phase-01-project-setup.md)
- Next: [Phase 3 - Backend Modules](phase-03-backend-modules.md)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 6h
- **Description**: Fastify app configuration, Drizzle ORM + PostgreSQL schema, JWT auth infrastructure, middleware, S3 client setup

## Key Insights

- Drizzle ORM uses TypeScript-first schema definition — no separate schema language
- Fastify plugins for cookie and CORS must be registered before routes
- Refresh tokens stored as bcrypt hashes in DB — never raw
- `@fastify/multipart` replaces multer in Fastify ecosystem
- Zod validates env at startup — fail fast on missing config

## Requirements

### Functional
- DB connection pool via `postgres` (pg driver for Drizzle)
- All 4 tables defined: `users`, `refresh_tokens`, `products`, `categories`
- JWT access token (15m) + refresh token (7d) with httpOnly secure cookies
- Auth middleware extracts and verifies access token from cookie
- S3 client configured and exported
- File upload via `@fastify/multipart`
- Global error handler for structured API errors

### Non-Functional
- Connection pool max 10 for dev, configurable via env
- Graceful shutdown drains DB pool
- All config validated via Zod at startup

## Architecture

### Database Schema (Drizzle)

```
users
  id: uuid PK (default gen_random_uuid())
  email: varchar(255) UNIQUE NOT NULL
  password_hash: varchar(255) NOT NULL
  name: varchar(100) NOT NULL
  avatar_key: varchar(500) NULL          -- S3 object key
  created_at: timestamptz DEFAULT now()
  updated_at: timestamptz DEFAULT now()

refresh_tokens
  id: uuid PK
  user_id: uuid FK -> users.id ON DELETE CASCADE
  token_hash: varchar(255) NOT NULL
  expires_at: timestamptz NOT NULL
  created_at: timestamptz DEFAULT now()

categories
  id: uuid PK
  name: varchar(100) UNIQUE NOT NULL
  description: text NULL
  created_at: timestamptz DEFAULT now()
  updated_at: timestamptz DEFAULT now()

products
  id: uuid PK
  name: varchar(200) NOT NULL
  description: text NULL
  price: numeric(10,2) NOT NULL
  category_id: uuid FK -> categories.id ON DELETE SET NULL
  image_key: varchar(500) NULL           -- S3 object key
  created_at: timestamptz DEFAULT now()
  updated_at: timestamptz DEFAULT now()
```

### Module Dependency Flow

```
server.ts -> app.ts -> plugins (cookie, cors, multipart)
                    -> config/env.ts (Zod validated)
                    -> config/db.ts (Drizzle + postgres pool)
                    -> config/s3.ts (S3Client)
                    -> middleware/authenticate.ts
                    -> middleware/error-handler.ts
                    -> routes (Phase 3)
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| Create | `backend/src/config/env.ts` | Zod env validation schema |
| Create | `backend/src/config/db.ts` | Drizzle instance + postgres pool |
| Create | `backend/src/config/s3.ts` | S3Client singleton |
| Create | `backend/src/db/schema/users.ts` | Users table schema |
| Create | `backend/src/db/schema/refresh-tokens.ts` | Refresh tokens table |
| Create | `backend/src/db/schema/categories.ts` | Categories table |
| Create | `backend/src/db/schema/products.ts` | Products table |
| Create | `backend/src/db/schema/index.ts` | Re-export all schemas |
| Create | `backend/src/lib/token.ts` | JWT sign/verify + cookie helpers |
| Create | `backend/src/lib/s3-upload.ts` | Upload to S3 + generate pre-signed URL |
| Create | `backend/src/middleware/authenticate.ts` | Fastify preHandler hook |
| Create | `backend/src/middleware/error-handler.ts` | Global error handler |
| Create | `backend/src/middleware/validate.ts` | Zod request validation wrapper |
| Create | `backend/drizzle.config.ts` | drizzle-kit migration config |
| Modify | `backend/src/app.ts` | Register plugins, middleware, error handler |
| Modify | `backend/src/server.ts` | Add DB pool shutdown |
| Modify | `backend/package.json` | Add `"db:generate"`, `"db:migrate"`, `"db:push"` scripts |

## Implementation Steps

### 1. Environment Config (`config/env.ts`)

1. Define Zod schema for all env vars:
   ```typescript
   const envSchema = z.object({
     DATABASE_URL: z.string().url(),
     JWT_ACCESS_SECRET: z.string().min(16),
     JWT_REFRESH_SECRET: z.string().min(16),
     AWS_REGION: z.string(),
     AWS_ACCESS_KEY_ID: z.string(),
     AWS_SECRET_ACCESS_KEY: z.string(),
     S3_BUCKET_NAME: z.string(),
     PORT: z.coerce.number().default(3000),
     FRONTEND_URL: z.string().url().default('http://localhost:5173'),
     NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
   });
   ```
2. Parse `process.env` through schema, export typed `env` object
3. Throw descriptive error on validation failure (list missing vars)

### 2. Database Setup (`config/db.ts`)

1. Import `postgres` from `postgres` package (not `pg`)
2. Create connection: `const client = postgres(env.DATABASE_URL, { max: 10 })`
3. Create Drizzle instance: `export const db = drizzle(client, { schema })`
4. Export `closeDb` function for graceful shutdown

### 3. Drizzle Schema Files

1. `db/schema/users.ts`:
   - Use `pgTable` from `drizzle-orm/pg-core`
   - Define all columns per schema above
   - Export `usersTable` and infer types: `type User = typeof usersTable.$inferSelect`
   - Export `NewUser = typeof usersTable.$inferInsert`

2. `db/schema/refresh-tokens.ts`:
   - FK relation to users with `ON DELETE CASCADE`
   - Index on `user_id` for lookup performance

3. `db/schema/categories.ts`:
   - Unique constraint on `name`

4. `db/schema/products.ts`:
   - FK to categories with `ON DELETE SET NULL`
   - Index on `category_id`
   - `price` as `numeric(10,2)` — use string in JS, parse to number at API layer

5. `db/schema/index.ts` — barrel re-export all tables + types

### 4. Drizzle Kit Config (`drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Add scripts to `package.json`:
- `"db:generate": "drizzle-kit generate"`
- `"db:migrate": "drizzle-kit migrate"`
- `"db:push": "drizzle-kit push"`
- `"db:studio": "drizzle-kit studio"`

### 5. S3 Client (`config/s3.ts`)

1. Create `S3Client` with region + credentials from env
2. Export singleton

### 6. S3 Upload Helper (`lib/s3-upload.ts`)

1. `uploadToS3(file: Buffer, key: string, contentType: string)` — PutObjectCommand
2. `getPresignedUrl(key: string, expiresIn = 3600)` — GetObjectCommand + getSignedUrl
3. `deleteFromS3(key: string)` — DeleteObjectCommand
4. Key format: `{module}/{uuid}-{originalname}` (e.g., `avatars/abc-123-photo.jpg`)

### 7. JWT Token Helpers (`lib/token.ts`)

1. `signAccessToken(userId: string)` — jwt.sign with `JWT_ACCESS_SECRET`, 15m expiry
2. `signRefreshToken(userId: string)` — jwt.sign with `JWT_REFRESH_SECRET`, 7d expiry
3. `verifyAccessToken(token: string)` — jwt.verify, return payload or throw
4. `verifyRefreshToken(token: string)` — same for refresh
5. `setAuthCookies(reply, accessToken, refreshToken)`:
   - `access_token`: httpOnly, secure (prod), sameSite lax, path `/`, maxAge 15m
   - `refresh_token`: httpOnly, secure (prod), sameSite lax, path `/api/auth/refresh`, maxAge 7d
6. `clearAuthCookies(reply)` — clear both cookies

### 8. Auth Middleware (`middleware/authenticate.ts`)

1. Fastify `preHandler` hook
2. Extract `access_token` from `request.cookies`
3. Verify with `verifyAccessToken()`
4. Attach `request.user = { id: payload.sub }` (use Fastify `decorateRequest`)
5. On failure: 401 `{ error: 'Unauthorized', message: 'Invalid or expired token' }`

### 9. Validation Middleware (`middleware/validate.ts`)

1. Factory function: `validate({ body?, params?, query? })` — each a Zod schema
2. Returns Fastify `preHandler` that parses and replaces `request.body/params/query`
3. On Zod error: 400 with formatted field errors

### 10. Error Handler (`middleware/error-handler.ts`)

1. Set as `app.setErrorHandler()`
2. Handle known error types:
   - `ZodError` -> 400 with field-level errors
   - `JsonWebTokenError` / `TokenExpiredError` -> 401
   - Fastify validation errors -> 400
   - Custom `AppError` class with statusCode -> use statusCode
   - Unknown -> 500 with generic message (log full error)
3. Response shape: `{ error: string, message: string, details?: object }`

### 11. App Assembly (`app.ts`)

1. Create Fastify instance with logger
2. Register `@fastify/cors` with `origin: env.FRONTEND_URL`, `credentials: true`
3. Register `@fastify/cookie`
4. Register `@fastify/multipart` with `limits: { fileSize: 5 * 1024 * 1024 }` (5MB)
5. Set error handler
6. Decorate request with `user: null` for auth middleware typing
7. Health check route: `GET /api/health` -> `{ status: 'ok' }`

### 12. Server Update (`server.ts`)

1. Import app + closeDb
2. Listen on `0.0.0.0:PORT`
3. SIGTERM/SIGINT: `await app.close()` then `await closeDb()`

## Todo List

- [ ] Create Zod env config with all vars
- [ ] Create DB connection + Drizzle instance
- [ ] Define users, refresh_tokens, categories, products schemas
- [ ] Create drizzle.config.ts and add migration scripts
- [ ] Run initial migration against PostgreSQL
- [ ] Create S3 client + upload/presign/delete helpers
- [ ] Create JWT sign/verify + cookie helpers
- [ ] Create authenticate middleware (preHandler)
- [ ] Create Zod validation middleware factory
- [ ] Create global error handler
- [ ] Wire everything in app.ts
- [ ] Add graceful shutdown in server.ts
- [ ] Test: health endpoint responds, DB connects, auth rejects unauthed

## Success Criteria

- `pnpm db:push` creates all 4 tables in PostgreSQL
- `GET /api/health` returns 200 with `{ status: 'ok' }`
- Request without cookie to protected route returns 401
- Env validation fails with clear message when var missing
- S3 upload/presign functions work with valid AWS credentials

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `postgres` driver ESM compatibility | High | Use `postgres` (not `pg`), native ESM support |
| Drizzle schema migration breaking | Medium | Use `db:push` for dev, `db:generate` + `db:migrate` for prod |
| S3 credentials invalid at startup | Medium | Validate S3 connectivity with a HeadBucket call on boot (optional) |
| JWT secret too short | High | Zod `.min(16)` enforced |

## Security Considerations

- **Refresh token hashed** with bcryptjs before DB storage — never store raw
- **httpOnly + secure cookies** — prevents XSS access to tokens
- **SameSite=Lax** — CSRF protection for cookie-based auth
- **Refresh token path** scoped to `/api/auth/refresh` — not sent on every request
- **5MB upload limit** — prevents DoS via large file upload
- **SQL injection**: Drizzle ORM uses parameterized queries by default
- **Error handler**: never exposes stack traces in production responses

## Next Steps

- Phase 3: Build auth, user, product, category route modules on top of this core
