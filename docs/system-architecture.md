# System Architecture

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS/HTTP
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nginx (Port 80/443)                        │
│              (Docker: frontend service)                      │
│  • Serves React SPA (dist/ static files)                    │
│  • Proxies /api/* → backend:3000                            │
│  • Handles compression, caching                             │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │ (Docker bridge network)
    ▼                 ▼
┌─────────────┐  ┌──────────────┐
│  Frontend   │  │   Backend    │
│ (SPA build) │  │ (Fastify)    │
│             │  │              │
│ React 18    │  │ TypeScript   │
│ TanStack    │  │ JWT auth     │
│ Query       │  │ S3 uploads   │
│ Zustand     │  │ DB queries   │
└─────────────┘  └──────┬───────┘
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
      ┌─────────┐  ┌──────────┐ ┌─────────┐
      │PostgreSQL  AWS S3      │ JWT Keys│
      │ (DB)  │  (file storage)│(secrets)│
      │       │  │            │
      │ Users │  │ Avatars    │
      │ Tokens│  │ Products   │
      │ etc.  │  │ Categories │
      └───────┘  └────────────┘ └─────────┘
```

## Component Details

### Frontend (React SPA)

**Stack**: React 18 + Vite + TypeScript + Ant Design v6 + TailwindCSS

**Key Files**:
- `src/pages/` — Page components (login, dashboard, users, products, categories)
- `src/store/auth-store.ts` — Zustand store, persisted to localStorage
- `src/lib/axios.ts` — Axios client with 401 refresh interceptor
- `src/router/` — React Router v7 with protected routes

**Responsibilities**:
- Render UI and handle user interactions
- Manage local auth state via Zustand (user profile)
- Cache server state via TanStack Query (CRUD lists, single items)
- Auto-refresh access token when 401 detected
- Multipart file uploads for avatar/product images

**Deployment**: Static files (dist/) served by nginx

### Backend (Fastify API)

**Stack**: Fastify 4 + TypeScript + Drizzle ORM + Zod validation

**Key Files**:
- `src/app.ts` — Fastify setup, middleware, route registration
- `src/modules/{auth,users,categories,products}/` — Route handlers, services, schemas
- `src/middleware/` — authenticate, validate (Zod), error-handler
- `src/lib/token.ts` — JWT sign/verify, cookie management
- `src/config/` — env parsing, db connection, S3 client

**Responsibilities**:
- Authenticate requests via httpOnly cookies
- Validate input with Zod schemas
- Execute CRUD operations on PostgreSQL
- Handle file uploads to S3
- Refresh token rotation (new token issued on each use)
- Return JSON responses (no HTML)

**API Patterns**:
- Routes registered with `/api/{resource}` prefix
- All non-auth routes require `authenticate` middleware
- Multipart routes parse fields + file streams manually
- Errors: 400 (validation), 401 (auth), 404 (not found), 500 (server)

### PostgreSQL

**Stack**: PostgreSQL 16 + Drizzle ORM

**Schemas**:
```
users (uuid, email unique, password_hash, name, avatar_key, timestamps)
refresh_tokens (id, user_id, hashed_token, expires_at)
categories (uuid, name, description, timestamps)
products (uuid, name, category_id FK, price, image_key, timestamps)
```

**Responsibilities**:
- Store user credentials (bcrypt-hashed passwords)
- Store refresh token hashes (rotated on each use)
- Store product/category data
- Enforce referential integrity (FK constraints)

### AWS S3

**Responsibilities**:
- Store user avatars (key: `avatars/{userId}/{filename}`)
- Store product images (key: `products/{productId}/{filename}`)
- Serve pre-signed URLs for temporary access (1 hour expiry)

**Operations**:
- `uploadToS3()` — PutObject with Content-Type
- `getPresignedUrl()` — Generate temporary GET URL
- `deleteFromS3()` — DeleteObject on user/product deletion

### Nginx

**Responsibilities** (Docker only):
- Listen on port 80 (mapped to host)
- Serve React SPA static files
- Proxy `/api/*` requests to backend:3000
- Compress responses, cache static assets
- Handle HTTP redirects if needed

## Data Flow — User Login

```
1. Frontend (React)
   └─ POST /api/auth/login { email, password }

2. Backend (Fastify)
   ├─ validateBody(loginSchema)
   ├─ Find user by email in PostgreSQL
   ├─ Compare password with bcrypt hash
   ├─ Sign JWT access token (15 min expiry)
   ├─ Sign JWT refresh token (7 day expiry)
   ├─ Hash refresh token, store in refresh_tokens table
   └─ setAuthCookies(reply, accessToken, refreshToken)
      ├─ Set-Cookie: access_token (httpOnly, sameSite=strict, 15min)
      └─ Set-Cookie: refresh_token (httpOnly, path=/api/auth/refresh, 7day)

3. Browser receives cookies
   ├─ Stores in httpOnly cookies (invisible to JS)
   └─ Frontend receives user profile JSON

4. Frontend (React)
   ├─ Store user in Zustand auth store (persisted to localStorage)
   └─ Navigate to /dashboard

5. Subsequent requests
   └─ axios automatically sends cookies (withCredentials: true)
      ├─ Fastify receives request
      ├─ authenticate middleware reads access_token from cookie
      ├─ Verify JWT signature with JWT_ACCESS_SECRET
      ├─ Continue if valid, 401 if not
```

## Data Flow — User Avatar Upload

```
1. Frontend (React)
   └─ PUT /api/users/:id (multipart)
      ├─ Field: name, email, password (optional)
      └─ File: avatar (binary)

2. Backend receives multipart stream
   ├─ Parse fields (validateBody not used for multipart)
   ├─ Buffer avatar file in memory
   ├─ Call usersService.updateUser(id, updates, avatarFile)
      ├─ Hash password if updated
      ├─ Upload new avatar to S3 if provided
      │  └─ Key: avatars/{userId}/{uuid}
      ├─ Delete old avatar from S3 if exists
      ├─ Update user row in PostgreSQL
      │  └─ Store new avatar_key
      └─ Return updated user object

3. Frontend receives updated user
   ├─ Display new avatar via pre-signed URL from S3
   └─ Refetch user via TanStack Query
```

## Data Flow — Product CRUD with Image

```
1. Frontend (React) - Create Product
   └─ POST /api/products (multipart)
      ├─ Field: name, categoryId, price
      └─ File: image (optional)

2. Backend
   ├─ Parse fields + image file
   ├─ Validate category_id exists (FK check happens in DB)
   ├─ Upload image to S3 if provided → Key: products/{newProductId}/{uuid}
   ├─ INSERT into products table
   │  └─ Stores: name, category_id, price, image_key, timestamps
   ├─ JOIN with categories table
   └─ Return full product object with category name

3. Frontend refetch
   └─ TanStack Query invalidates 'products' cache
      └─ GET /api/products (auto-refetch)
         ├─ Backend queries: SELECT * FROM products LEFT JOIN categories
         └─ Frontend renders list with images via S3 pre-signed URLs
```

## Authentication Flow

### Access Token Refresh (401 Handling)

```
1. Frontend makes API request with access_token cookie
2. Backend returns 401 (token expired)
3. axios interceptor (lib/axios.ts) detects 401
   ├─ Queue other failed requests
   ├─ POST /api/auth/refresh (sends refresh_token cookie)
4. Backend (auth.service.refreshSession)
   ├─ Verify refresh_token JWT signature
   ├─ Find refresh token hash in DB
   ├─ Compare provided token hash with stored hash
   ├─ Issue new access_token + refresh_token
   ├─ Delete old refresh token from DB
   ├─ Store new refresh token hash in DB
   └─ setAuthCookies(reply, newAccessToken, newRefreshToken)
5. axios interceptor processes queue, retries original request
6. Frontend continues (user unaware of refresh)
```

### Logout

```
1. Frontend: POST /api/auth/logout
2. Backend (requires authenticate middleware)
   ├─ Get user.id from request.user (set by authenticate)
   ├─ Hash refresh_token cookie value
   ├─ DELETE refresh token hash from DB
   └─ clearAuthCookies(reply)
3. Frontend clears Zustand auth store
4. Frontend redirects to /login
```

## Docker Networking

**In docker-compose.yml**:
- Services on same internal bridge network (no explicit network needed)
- Hostname resolution: `backend` service accessible via `http://backend:3000`
- Port mapping: Only `frontend` (nginx) maps port 80 to host; others internal only
- Database: `postgres` service hostname, port 5432 (internal)
- Environment: Backend uses `DATABASE_URL=postgresql://admin:pass@postgres:5432/crud_admin`

**Health checks**: postgres checks `pg_isready`; backend waits for postgres healthy before starting

## Deployment Environments

### Local Development
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend: `http://localhost:3000` (Fastify)
- PostgreSQL: `localhost:5432`
- No nginx; React proxy in Vite config (optional)

### Docker Compose
- Frontend: `http://localhost` (nginx on port 80)
- Backend: Internal via `http://backend:3000`
- PostgreSQL: Internal via `postgres:5432`
- All services on docker bridge network

### Production (not in scope for this doc)
- Frontend: CloudFront + S3 or Vercel
- Backend: ECS / Lambda + ALB
- Database: RDS PostgreSQL
- S3: Already multi-region by default
- TLS: CloudFront / ALB handles HTTPS

## Error Handling

| Error | Source | Response |
|-------|--------|----------|
| 400 Bad Request | Zod validation | `{ error: "Validation failed", details: [{field, message}] }` |
| 401 Unauthorized | Missing/expired token | `{ error: "Unauthorized" }` |
| 404 Not Found | Fastify default | `{ error: "Not found" }` |
| 500 Internal Error | Unhandled exception | `{ error: "Internal server error" }` (no stack trace) |

**Error Handler**: `src/middleware/error-handler.ts` catches all errors before response sent

## Scaling Considerations

- **Stateless backend**: Can run multiple Fastify instances behind a load balancer
- **Session storage**: Refresh tokens in DB (not in-memory); allows horizontal scaling
- **File storage**: S3 is external, shared across backend instances
- **Database**: PostgreSQL connection pooling needed (PgBouncer recommended for 10+ backend instances)
- **Frontend cache**: TanStack Query handles local caching; S3 URLs are pre-signed (1 hour expiry)
