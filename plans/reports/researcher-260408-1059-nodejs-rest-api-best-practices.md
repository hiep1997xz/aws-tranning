# Node.js REST API Best Practices Research
Date: 2026-04-08 | Scope: Express/Fastify + TypeScript + PostgreSQL + JWT + S3

---

## 1. Express vs Fastify — RECOMMEND: Fastify

| Factor | Express | Fastify |
|--------|---------|---------|
| Throughput | ~15k req/s | ~30k req/s (2x faster) |
| TypeScript | External `@types/express` | First-class, built-in schema validation |
| Schema validation | Manual (zod/joi wiring) | JSON Schema built-in (ajv), auto-serialization |
| Ecosystem maturity | Huge, older | Actively maintained, growing fast |
| Learning curve | Minimal | Minimal — near-identical routing API |

**Rationale:** Fastify's native TypeScript support, built-in JSON Schema validation, and auto-serialization eliminate 2-3 boilerplate layers. For a greenfield project with TypeScript, it's the better choice. Express is fine if the team is already on it.

---

## 2. ORM/Query Builder — RECOMMEND: Drizzle ORM

| Factor | Prisma | TypeORM | Drizzle |
|--------|--------|---------|---------|
| TypeScript inference | Generated client | Decorator-based, looser | Best-in-class, SQL-like |
| Bundle size | Heavy (Rust engine) | Medium | Lightweight, no codegen daemon |
| Raw SQL escape | Easy via `$queryRaw` | `query()` | First-class — it *is* SQL |
| Migration strategy | Prisma Migrate | Built-in | `drizzle-kit push/generate` |
| PostgreSQL features | Good | OK | Excellent (CTEs, RETURNING, jsonb) |
| Maintenance | Prisma Inc. (VC-backed) | Community | Growing, active |

**Rationale:** Drizzle gives full PostgreSQL type safety without a separate runtime process. Schema is plain TypeScript; migrations are SQL files you own. Prisma is fine but carries Rust binary overhead and a migration lock file that causes friction in teams. TypeORM's decorator pattern degrades under strict TypeScript.

---

## 3. Project Folder Structure

```
src/
  config/           # env validation (zod), db pool, aws s3 client
  db/
    schema/         # drizzle table definitions
    migrations/     # generated SQL files
  modules/
    auth/
      auth.controller.ts
      auth.service.ts
      auth.routes.ts
    users/
      user.controller.ts
      user.service.ts
      user.repository.ts
      user.routes.ts
    products/
      product.controller.ts
      product.service.ts
      product.repository.ts
      product.routes.ts
    categories/
      (same pattern)
  middleware/
    authenticate.ts    # JWT cookie verification
    error-handler.ts
    validate.ts        # JSON Schema or zod wrapper
  lib/
    s3-upload.ts       # multer-s3 config factory
    token.ts           # sign/verify JWT helpers
  app.ts              # Fastify instance, plugin registration
  server.ts           # listen, graceful shutdown
```

**Rules:**
- Controller: parse request, call service, return response — no business logic
- Service: business logic, calls repository — no HTTP knowledge
- Repository: DB queries only (drizzle calls) — no business logic
- One `routes.ts` per module wires controller + middleware

---

## 4. JWT httpOnly Cookie Strategy

### Token Pair
- **Access token:** 15m TTL, signed with `ACCESS_TOKEN_SECRET`
- **Refresh token:** 7d TTL, signed with `REFRESH_TOKEN_SECRET`, stored in DB (revocable)

### Cookie Settings
```typescript
// access token
reply.setCookie('access_token', accessJwt, {
  httpOnly: true,
  secure: true,         // HTTPS only in production
  sameSite: 'strict',
  path: '/',
  maxAge: 60 * 15,      // 15 min in seconds
});

// refresh token — tighter path
reply.setCookie('refresh_token', refreshJwt, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth/refresh', // only sent on refresh endpoint
  maxAge: 60 * 60 * 24 * 7,
});
```

### Refresh Flow
1. Client hits any protected route → 401 if access token expired
2. Client (automatic, via cookie) hits `POST /auth/refresh`
3. Server: verify refresh JWT → check DB hash match → issue new access token
4. On logout: delete both cookies + delete refresh record from DB
5. Refresh token rotation: on each use, issue new refresh token, invalidate old

### DB Table (drizzle)
```typescript
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),  // bcrypt hash, not raw token
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

---

## 5. AWS S3 Upload with multer-s3

### Package: `multer` + `@aws-sdk/client-s3` + `multer-s3`
Note: `multer-s3` v3 is compatible with AWS SDK v3. Use `multer-s3@3.x`.

```typescript
// lib/s3-upload.ts
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export const uploadProductImage = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET!,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `products/${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME.includes(file.mimetype));
  },
});
```

**Security notes (from TypeScript security rules):**
- Validate MIME type server-side (above) — do not trust extension alone
- Generate random file names (uuid) — prevents enumeration
- Keep bucket private; generate pre-signed URLs for access (do not make objects public)
- Store only S3 key in DB, not full URL (URL changes if bucket region/CDN changes)

---

## Key Dependencies

```
fastify @fastify/cookie @fastify/multipart
drizzle-orm drizzle-kit pg
@aws-sdk/client-s3 multer multer-s3
jsonwebtoken bcryptjs
zod
```

---

## Unresolved Questions

1. **Rate limiting on `/auth/refresh`** — needs Redis or in-memory store decision
2. **Access token revocation** — 15m window acceptable, or need token blacklist?
3. **S3 pre-signed URLs TTL** — depends on use case (1h for products is typical)
4. **DB connection pool size** — need expected concurrency; default `pg` pool is 10; formula: `(2 × CPU cores) + disk spindles`
5. **Fastify vs Express** — if team already has Express expertise and no perf concerns, Express is acceptable
