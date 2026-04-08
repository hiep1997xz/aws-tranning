---
spec_id: phase-01-project-setup
status: pending
acceptance_criteria:
  - Both backend/ and frontend/ dirs with valid package.json and tsconfig.json
  - ESLint + Prettier configs present and runnable
  - .env.example with all required env vars documented
  - "npm run dev" works in both backend and frontend (empty shell)
---

# Phase 1: Project Setup

## Context Links

- [Plan Overview](plan.md)
- Next: [Phase 2 - Backend Core](phase-02-backend-core.md)

## Overview

- **Priority**: P1 (blocker for all phases)
- **Status**: Pending
- **Effort**: 3h
- **Description**: Initialize monorepo structure, TypeScript configs, linting, formatting, env templates

## Key Insights

- No workspace tooling (pnpm workspaces / turborepo) — KISS, two independent dirs
- Shared nothing between backend/frontend except `.env.example` at root
- ESLint flat config (`eslint.config.mjs`) for both — modern approach
- Prettier as formatter, ESLint for logic rules only (no formatting rules in ESLint)

## Requirements

### Functional
- `backend/` — Fastify TypeScript project skeleton
- `frontend/` — Vite React TypeScript project skeleton
- Root-level `.env.example` with all env vars
- Both projects compilable with zero errors

### Non-Functional
- Node 20 LTS minimum
- Strict TypeScript (`strict: true`)
- Consistent code style enforced by tooling

## Architecture

```
aws-tranning/
  backend/
    src/
      app.ts          # empty Fastify instance
      server.ts       # listen entry
    package.json
    tsconfig.json
    eslint.config.mjs
    .prettierrc
  frontend/
    src/
      main.tsx        # React entry
      App.tsx          # placeholder
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    eslint.config.mjs
    .prettierrc
  .env.example
  .gitignore
  docker-compose.yml  # placeholder
  README.md
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| Create | `backend/package.json` | Fastify + TS deps |
| Create | `backend/tsconfig.json` | Strict TS, ESM target |
| Create | `backend/eslint.config.mjs` | Flat config, TS parser |
| Create | `backend/.prettierrc` | 2-space indent, single quotes, trailing comma |
| Create | `backend/src/app.ts` | Empty Fastify instance export |
| Create | `backend/src/server.ts` | Listen + graceful shutdown |
| Create | `frontend/package.json` | React + Vite + antd + Tailwind deps |
| Create | `frontend/tsconfig.json` | Strict TS, JSX preserve, path aliases |
| Create | `frontend/vite.config.ts` | React plugin, path alias `@/` |
| Create | `frontend/eslint.config.mjs` | Flat config, React + TS |
| Create | `frontend/.prettierrc` | Same as backend |
| Create | `frontend/index.html` | Vite entry HTML |
| Create | `frontend/src/main.tsx` | React root |
| Create | `frontend/src/App.tsx` | Placeholder component |
| Create | `.env.example` | All env vars documented |
| Create | `.gitignore` | node_modules, dist, .env, etc. |

## Implementation Steps

### 1. Root Files

1. Create `.gitignore`:
   ```
   node_modules/
   dist/
   .env
   *.log
   coverage/
   .DS_Store
   ```

2. Create `.env.example`:
   ```env
   # Database
   DATABASE_URL=postgresql://admin:password@localhost:5432/crud_admin
   
   # JWT
   JWT_ACCESS_SECRET=change-me-access-secret
   JWT_REFRESH_SECRET=change-me-refresh-secret
   
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

### 2. Backend Setup

1. `mkdir -p backend/src && cd backend`
2. `npm init -y` then edit package.json:
   - `"type": "module"`
   - Scripts: `"dev": "tsx watch src/server.ts"`, `"build": "tsc"`, `"start": "node dist/server.js"`
3. Install deps:
   ```bash
   pnpm add fastify @fastify/cookie @fastify/cors @fastify/multipart drizzle-orm postgres zod jsonwebtoken bcryptjs @aws-sdk/client-s3 @aws-sdk/s3-request-presigner dotenv
   pnpm add -D typescript tsx @types/node @types/jsonwebtoken @types/bcryptjs drizzle-kit eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier
   ```
4. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "outDir": "dist",
       "rootDir": "src",
       "declaration": true,
       "resolveJsonModule": true,
       "sourceMap": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```
5. Create `src/app.ts` — export Fastify instance with CORS + cookie plugin registration
6. Create `src/server.ts` — import app, listen on `PORT`, SIGTERM/SIGINT graceful shutdown

### 3. Frontend Setup

1. `pnpm create vite frontend -- --template react-ts`
2. Install additional deps:
   ```bash
   pnpm add antd @ant-design/icons zustand @tanstack/react-query axios react-router-dom
   pnpm add -D tailwindcss postcss autoprefixer @types/react @types/react-dom eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks prettier
   ```
3. `npx tailwindcss init -p` — configure `content: ["./index.html", "./src/**/*.{ts,tsx}"]`
4. Update `vite.config.ts` — add path alias `@/` pointing to `src/`
5. Update `tsconfig.json` — add `paths: { "@/*": ["./src/*"] }`, strict mode
6. Create minimal `src/App.tsx` with "Admin Panel" heading
7. Update `src/main.tsx` — mount React root

### 4. ESLint + Prettier (both projects)

1. `.prettierrc` in both:
   ```json
   {
     "semi": true,
     "singleQuote": true,
     "trailingComma": "all",
     "tabWidth": 2,
     "printWidth": 100
   }
   ```
2. `eslint.config.mjs` — flat config with `@typescript-eslint/recommended`, no formatting rules

### 5. Verification

1. `cd backend && pnpm dev` — should start Fastify on port 3000
2. `cd frontend && pnpm dev` — should start Vite on port 5173
3. `pnpm lint` passes in both
4. TypeScript compilation: `pnpm build` succeeds in both

## Todo List

- [ ] Create root `.gitignore` and `.env.example`
- [ ] Initialize backend with package.json, tsconfig, ESLint, Prettier
- [ ] Create backend app.ts and server.ts skeleton
- [ ] Scaffold frontend with Vite + React + TS template
- [ ] Install antd, Tailwind, Zustand, TanStack Query, Axios, React Router
- [ ] Configure TailwindCSS with PostCSS
- [ ] Configure path aliases in Vite + tsconfig
- [ ] Verify both projects compile and run

## Success Criteria

- `pnpm dev` starts both backend (Fastify) and frontend (Vite) without errors
- `pnpm build` compiles both without TS errors
- ESLint passes with zero warnings on skeleton code
- `.env.example` documents every required env var

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ESM vs CJS conflicts in Node | High | Use `"type": "module"` + `tsx` for dev, verify imports |
| Tailwind + antd style conflicts | Medium | Addressed in Phase 4 with `@layer` strategy |
| Version mismatches between deps | Low | Pin major versions in package.json |

## Security Considerations

- `.env` excluded from `.gitignore` — secrets never committed
- `.env.example` uses placeholder values only
- No real AWS credentials in any committed file

## Next Steps

- Phase 2: Backend Core (Fastify app, Drizzle DB, auth middleware)
