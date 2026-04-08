---
spec_id: phase-03-backend-modules
status: pending
acceptance_criteria:
  - POST /api/auth/login returns access+refresh cookies on valid credentials
  - POST /api/auth/refresh rotates refresh token and issues new access token
  - POST /api/auth/logout clears cookies and deletes refresh token from DB
  - Users CRUD (list/get/create/update/delete) with avatar S3 upload
  - Products CRUD with image S3 upload and category association
  - Categories CRUD with cascade awareness
  - All routes validate input via Zod schemas
  - Pagination (page/limit/search) on list endpoints
---

# Phase 3: Backend Modules

## Context Links

- [Plan Overview](plan.md)
- Previous: [Phase 2 - Backend Core](phase-02-backend-core.md)
- Next: [Phase 4 - Frontend Core](phase-04-frontend-core.md)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 8h
- **Description**: Auth routes (login/logout/refresh), Users CRUD + avatar upload, Products CRUD + image upload, Categories CRUD. All with Zod validation, pagination, error handling.

## Key Insights

- Module pattern: `routes.ts` -> `controller.ts` -> `service.ts` -> `repository.ts` (optional, service can use db directly for simple CRUD)
- Repository layer only if query logic is complex; service calls `db` directly for simple ops
- Refresh token rotation: on each `/refresh`, invalidate old token, issue new pair
- S3 upload happens in controller (parse multipart), service handles business logic
- Pagination: offset-based (`page` + `limit`), return `{ data, total, page, limit, totalPages }`

## Requirements

### Functional

**Auth Module**
- `POST /api/auth/login` — email + password -> set cookies
- `POST /api/auth/refresh` — rotate refresh token, issue new access token
- `POST /api/auth/logout` — clear cookies, delete refresh token from DB
- `GET /api/auth/me` — return current user (protected)

**Users Module**
- `GET /api/users` — paginated list (search by name/email)
- `GET /api/users/:id` — single user with avatar pre-signed URL
- `POST /api/users` — create user (with optional avatar upload)
- `PUT /api/users/:id` — update user (with optional avatar replace)
- `DELETE /api/users/:id` — delete user + cleanup S3 avatar

**Products Module**
- `GET /api/products` — paginated list (search by name, filter by category_id)
- `GET /api/products/:id` — single product with image pre-signed URL
- `POST /api/products` — create with optional image upload
- `PUT /api/products/:id` — update with optional image replace
- `DELETE /api/products/:id` — delete + cleanup S3 image

**Categories Module**
- `GET /api/categories` — paginated list (search by name)
- `GET /api/categories/all` — unpaginated list (for dropdowns)
- `GET /api/categories/:id` — single category
- `POST /api/categories` — create
- `PUT /api/categories/:id` — update
- `DELETE /api/categories/:id` — delete (warn if products reference it)

### Non-Functional
- All protected routes use `authenticate` preHandler
- All mutations validate request body with Zod
- Consistent JSON response shape across all endpoints
- S3 cleanup on entity deletion (best-effort, don't fail delete if S3 fails)

## Architecture

### Route Registration Pattern

```
app.ts
  -> app.register(authRoutes, { prefix: '/api/auth' })
  -> app.register(userRoutes, { prefix: '/api/users' })
  -> app.register(productRoutes, { prefix: '/api/products' })
  -> app.register(categoryRoutes, { prefix: '/api/categories' })
```

### Module Structure (per module)

```
modules/auth/
  auth.routes.ts       # Fastify plugin with route definitions
  auth.controller.ts   # Request handling, call service, format response
  auth.service.ts      # Business logic (hash password, verify, token rotation)
  auth.schema.ts       # Zod schemas for request validation

modules/users/
  user.routes.ts
  user.controller.ts
  user.service.ts
  user.schema.ts

modules/products/
  product.routes.ts
  product.controller.ts
  product.service.ts
  product.schema.ts

modules/categories/
  category.routes.ts
  category.controller.ts
  category.service.ts
  category.schema.ts
```

### Pagination Response Shape

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### Auth Flow (Login)

```
Client -> POST /api/auth/login { email, password }
  -> auth.controller.login()
    -> auth.service.login(email, password)
      -> find user by email
      -> bcrypt.compare(password, user.password_hash)
      -> signAccessToken(user.id)
      -> signRefreshToken(user.id)
      -> hash refresh token with bcrypt
      -> insert into refresh_tokens
      -> return { accessToken, refreshToken, user }
    -> setAuthCookies(reply, accessToken, refreshToken)
    -> reply 200 { user: { id, email, name, avatarUrl } }
```

### Auth Flow (Refresh)

```
Client -> POST /api/auth/refresh (refresh_token cookie auto-sent)
  -> auth.controller.refresh()
    -> extract refresh_token from cookie
    -> verifyRefreshToken(token) -> { sub: userId }
    -> find all refresh_tokens for userId
    -> bcrypt.compare(token, each stored hash) -> find match
    -> delete matched token from DB (rotation)
    -> issue new access + refresh tokens
    -> hash new refresh, insert into DB
    -> setAuthCookies(reply, newAccess, newRefresh)
    -> reply 200 { user }
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| Create | `backend/src/modules/auth/auth.routes.ts` | Auth route plugin |
| Create | `backend/src/modules/auth/auth.controller.ts` | Login/logout/refresh/me handlers |
| Create | `backend/src/modules/auth/auth.service.ts` | Auth business logic |
| Create | `backend/src/modules/auth/auth.schema.ts` | Zod: loginSchema |
| Create | `backend/src/modules/users/user.routes.ts` | User CRUD routes |
| Create | `backend/src/modules/users/user.controller.ts` | User handlers |
| Create | `backend/src/modules/users/user.service.ts` | User business logic |
| Create | `backend/src/modules/users/user.schema.ts` | Zod: createUser, updateUser, listQuery |
| Create | `backend/src/modules/products/product.routes.ts` | Product CRUD routes |
| Create | `backend/src/modules/products/product.controller.ts` | Product handlers |
| Create | `backend/src/modules/products/product.service.ts` | Product business logic |
| Create | `backend/src/modules/products/product.schema.ts` | Zod: createProduct, updateProduct |
| Create | `backend/src/modules/categories/category.routes.ts` | Category CRUD routes |
| Create | `backend/src/modules/categories/category.controller.ts` | Category handlers |
| Create | `backend/src/modules/categories/category.service.ts` | Category business logic |
| Create | `backend/src/modules/categories/category.schema.ts` | Zod: createCategory, updateCategory |
| Create | `backend/src/lib/pagination.ts` | Shared pagination helper |
| Create | `backend/src/lib/api-error.ts` | Custom AppError class |
| Modify | `backend/src/app.ts` | Register all route plugins |

## Implementation Steps

### 1. Shared Utilities

1. **`lib/api-error.ts`**: Custom error class
   ```typescript
   export class AppError extends Error {
     constructor(public statusCode: number, message: string) {
       super(message);
     }
   }
   ```

2. **`lib/pagination.ts`**: Helper for paginated queries
   ```typescript
   export function paginationParams(query: { page?: number; limit?: number }) {
     const page = Math.max(1, query.page ?? 1);
     const limit = Math.min(100, Math.max(1, query.limit ?? 10));
     const offset = (page - 1) * limit;
     return { page, limit, offset };
   }

   export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
     return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
   }
   ```

### 2. Auth Module

1. **`auth.schema.ts`**:
   - `loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) })`

2. **`auth.service.ts`**:
   - `login(email, password)`: find user -> compare -> sign tokens -> hash refresh -> insert DB -> return
   - `refresh(refreshToken)`: verify JWT -> find matching hash in DB -> delete old -> issue new pair -> return
   - `logout(userId, refreshToken)`: find and delete matching token from DB
   - `getMe(userId)`: find user by ID, generate avatar pre-signed URL if avatar_key exists

3. **`auth.controller.ts`**:
   - `login(request, reply)`: validate body -> service.login -> setAuthCookies -> respond
   - `refresh(request, reply)`: extract cookie -> service.refresh -> setAuthCookies -> respond
   - `logout(request, reply)`: extract cookie -> service.logout -> clearAuthCookies -> respond
   - `me(request, reply)`: service.getMe(request.user.id) -> respond

4. **`auth.routes.ts`**: Fastify plugin
   ```typescript
   export const authRoutes: FastifyPluginAsync = async (app) => {
     app.post('/login', { preHandler: [validate({ body: loginSchema })] }, authController.login);
     app.post('/refresh', authController.refresh);
     app.post('/logout', { preHandler: [authenticate] }, authController.logout);
     app.get('/me', { preHandler: [authenticate] }, authController.me);
   };
   ```

### 3. Users Module

1. **`user.schema.ts`**:
   - `createUserSchema`: email, password (.min(6)), name
   - `updateUserSchema`: email?, password?, name? (all optional)
   - `listUsersQuerySchema`: page?, limit?, search?

2. **`user.service.ts`**:
   - `list(page, limit, search?)`: SQL with `ILIKE` on name/email, count total, return paginated
   - `getById(id)`: find user, generate avatar presigned URL
   - `create(data, avatarFile?)`: hash password, upload avatar if present, insert
   - `update(id, data, avatarFile?)`: hash password if changed, replace avatar if present (delete old from S3), update
   - `remove(id)`: find user, delete S3 avatar if exists, delete user

3. **`user.controller.ts`**:
   - Handle multipart: parse fields + file from `request.parts()`
   - Pass parsed data + file buffer to service
   - Return user with avatar URL (not raw key)

4. **`user.routes.ts`**: All routes behind `authenticate` preHandler
   ```
   GET    /          -> list
   GET    /:id       -> getById
   POST   /          -> create (multipart)
   PUT    /:id       -> update (multipart)
   DELETE /:id       -> remove
   ```

### 4. Products Module

1. **`product.schema.ts`**:
   - `createProductSchema`: name, description?, price (z.coerce.number().positive()), category_id?
   - `updateProductSchema`: all optional
   - `listProductsQuerySchema`: page?, limit?, search?, category_id?

2. **`product.service.ts`**:
   - `list(page, limit, search?, categoryId?)`: filter by name ILIKE + optional category_id
   - `getById(id)`: join category name, generate image presigned URL
   - `create(data, imageFile?)`: upload image, insert
   - `update(id, data, imageFile?)`: replace image if new one provided, update
   - `remove(id)`: delete S3 image, delete product

3. **`product.controller.ts`**: Same multipart pattern as users

4. **`product.routes.ts`**: All protected, same CRUD pattern

### 5. Categories Module

1. **`category.schema.ts`**:
   - `createCategorySchema`: name, description?
   - `updateCategorySchema`: name?, description?
   - `listCategoriesQuerySchema`: page?, limit?, search?

2. **`category.service.ts`**:
   - `list(page, limit, search?)`: ILIKE on name
   - `getAll()`: simple select all, ordered by name (for dropdowns)
   - `getById(id)`: find by ID
   - `create(data)`: insert, handle unique constraint error
   - `update(id, data)`: update, handle unique constraint
   - `remove(id)`: count products referencing this category, warn in response if > 0, delete

3. **`category.controller.ts`**: Standard JSON handlers (no multipart)

4. **`category.routes.ts`**: All protected
   ```
   GET    /          -> list (paginated)
   GET    /all       -> getAll (unpaginated, for dropdowns)
   GET    /:id       -> getById
   POST   /          -> create
   PUT    /:id       -> update
   DELETE /:id       -> remove
   ```

### 6. Route Registration (`app.ts`)

```typescript
app.register(authRoutes, { prefix: '/api/auth' });
app.register(userRoutes, { prefix: '/api/users' });
app.register(productRoutes, { prefix: '/api/products' });
app.register(categoryRoutes, { prefix: '/api/categories' });
```

### 7. Seed Script (Optional, for Dev)

Create `backend/src/db/seed.ts`:
- Insert 1 admin user (email: admin@admin.com, password: password123)
- Insert 5 sample categories
- Insert 10 sample products
- Add script: `"db:seed": "tsx src/db/seed.ts"`

## Todo List

- [ ] Create AppError class and pagination helpers
- [ ] Implement auth module (schema, service, controller, routes)
- [ ] Test login/refresh/logout/me flow manually
- [ ] Implement users CRUD with multipart avatar upload
- [ ] Implement products CRUD with multipart image upload
- [ ] Implement categories CRUD
- [ ] Register all routes in app.ts
- [ ] Create seed script with sample data
- [ ] Test all endpoints with curl or HTTP client

## Success Criteria

- Login returns cookies, `/me` returns user, refresh rotates token, logout clears cookies
- Users: create with avatar, list with search, update avatar, delete cleans S3
- Products: create with image + category, list with filters, update, delete cleans S3
- Categories: CRUD works, `/all` returns flat list, delete warns about referencing products
- All invalid inputs return 400 with Zod field errors
- All unauthed requests return 401

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multipart parsing complexity in Fastify | Medium | Use `@fastify/multipart` `request.parts()` iterator pattern |
| Refresh token race condition (concurrent refreshes) | Medium | Delete token before issuing new one; client retry queue handles 401 |
| S3 delete failure on entity delete | Low | Best-effort: log warning, don't fail the delete operation |
| Large file uploads blocking event loop | Low | `@fastify/multipart` streams by default; 5MB limit |

## Security Considerations

- **Password hashing**: bcryptjs with salt rounds 10 (default)
- **Refresh token rotation**: old token deleted immediately on refresh — single-use
- **Token family detection**: if a reused refresh token is detected, delete ALL refresh tokens for that user (prevent token theft replay)
- **Input validation**: all bodies validated via Zod before reaching service layer
- **SQL injection**: Drizzle parameterized queries throughout
- **S3 keys**: never exposed to client — only pre-signed URLs with 1h expiry
- **Password in response**: NEVER return `password_hash` — select specific columns or use `.omit()`

## Next Steps

- Phase 4: Frontend core (Vite, Tailwind+antd, Axios, Router, Layout)
