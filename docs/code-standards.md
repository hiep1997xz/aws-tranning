# Code Standards & Patterns

## File & Folder Naming

### Backend (TypeScript)

```
src/
├── config/           # Config files, env parsing
│   ├── env.ts        # Load & validate env vars
│   ├── db.ts         # Drizzle db instance
│   └── s3.ts         # AWS S3 client
├── db/
│   └── schema/       # Drizzle ORM table definitions
│       ├── users.ts
│       ├── refresh-tokens.ts
│       ├── categories.ts
│       ├── products.ts
│       └── index.ts  # Export all schemas
├── lib/              # Utility functions (no dependencies on modules)
│   ├── token.ts      # JWT sign/verify
│   └── s3-upload.ts  # S3 operations
├── middleware/       # Fastify preHandlers
│   ├── authenticate.ts
│   ├── validate.ts   # Zod validation preHandlers
│   └── error-handler.ts
└── modules/          # Feature modules (each has schema.ts, service.ts, routes.ts)
    ├── auth/
    │   ├── auth.schema.ts
    │   ├── auth.service.ts
    │   └── auth.routes.ts
    ├── users/
    ├── categories/
    └── products/
```

**Naming Conventions**:
- Files: `kebab-case.ts` (e.g., `auth-routes.ts`, `error-handler.ts`)
- Exports: `camelCase` for functions, `PascalCase` for types/interfaces
- Services: Exported as namespace (e.g., `import * as usersService from '...'`)

### Frontend (TypeScript + React)

```
src/
├── pages/            # Page components (one file per route)
│   ├── login.tsx
│   ├── dashboard.tsx
│   ├── users.tsx
│   ├── products.tsx
│   └── categories.tsx
├── components/       # Reusable UI components
│   ├── layout/
│   │   ├── app-layout.tsx
│   │   ├── app-header.tsx
│   │   └── sidebar.tsx
│   └── common/       # Generic components (buttons, modals, etc.)
├── router/           # React Router setup
│   ├── index.tsx
│   └── protected-route.tsx
├── store/            # Zustand stores
│   └── auth-store.ts
├── lib/              # Utilities (no React deps)
│   └── axios.ts
├── types/            # TypeScript type definitions
│   ├── entities.ts   # User, Product, Category, etc.
│   └── api.ts        # API request/response types
└── App.tsx           # Root component
```

**Naming Conventions**:
- Components: `PascalCase.tsx` (e.g., `AppHeader.tsx`, `LoginForm.tsx`)
- Page components: `camelCase.tsx` (e.g., `login.tsx`, `users.tsx`)
- Hooks: `use` prefix (e.g., `useAuth()`, `useUsers()`)
- Types: `PascalCase` (e.g., `User`, `LoginRequest`)

## TypeScript Standards

### Strict Mode (Required)

All files must compile with `strict: true` in `tsconfig.json`:
- No `any` without explicit comment
- No implicit `any`
- No null/undefined without proper checks

```typescript
// ❌ BAD
function getValue(obj: any) {
  return obj.value;
}

// ✅ GOOD
function getValue(obj: Record<string, unknown>): unknown {
  return obj.value;
}
```

### Type Imports

Use `import type` for types, `import` for values:

```typescript
// ✅ GOOD
import type { User } from '../types/entities';
import { useQuery } from '@tanstack/react-query';

// ❌ BAD
import { User, useQuery } from '../types/entities';
```

### Generics & Type Inference

Leverage inference; don't over-annotate:

```typescript
// ✅ GOOD
const users = await usersService.listUsers();  // Type inferred from service return

// ❌ BAD
const users: User[] = await usersService.listUsers();
```

## Backend Patterns

### Module Structure: Schema → Service → Routes

Each module (`auth`, `users`, etc.) follows this pattern:

**1. Schema** (`auth.schema.ts`): Zod validation + TypeScript types

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof loginSchema>;
```

**2. Service** (`auth.service.ts`): Business logic, no HTTP knowledge

```typescript
export const login = async (email: string, password: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error('User not found');
  
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) throw new Error('Invalid password');
  
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  
  // Hash & store refresh token
  const hashedRefresh = hashToken(refreshToken);
  await db.insert(refreshTokens).values({ userId: user.id, hashedToken: hashedRefresh });
  
  return { accessToken, refreshToken, user: omit(user, ['passwordHash']) };
};
```

**3. Routes** (`auth.routes.ts`): HTTP handlers, delegate to service

```typescript
export default async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', { preHandler: [validateBody(loginSchema)] }, async (request, reply) => {
    const { accessToken, refreshToken, user } = await authService.login(request.body.email, request.body.password);
    setAuthCookies(reply, accessToken, refreshToken);
    return reply.send({ user });
  });
}
```

### Validation: Zod Schemas

All user input validated with Zod. Validation happens in middleware (`preHandler`):

```typescript
// Define schema
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

// In route
app.put('/:id', { preHandler: [validateParams(userIdParamSchema)] }, async (request, reply) => {
  // request.body already validated & typed
  const updates = request.body as z.infer<typeof updateUserSchema>;
});
```

### Error Handling

- **Throw errors in services** — include meaningful messages
- **Error handler middleware** (`error-handler.ts`) catches and formats
- **Status codes**: 400 (validation), 401 (auth), 404 (not found), 500 (server)

```typescript
// Service
export const getUser = async (id: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error('User not found');  // → caught, formatted as 404
  return user;
};

// Error handler formats as:
// { error: "User not found", statusCode: 404 }
```

### Fastify Patterns

**Middleware Order** (preHandler):
1. Validation (if needed) — e.g., `validateBody(schema)`
2. Authentication — e.g., `authenticate`
3. Authorization — custom checks (if needed)

```typescript
app.post('/admin', {
  preHandler: [authenticate, requireAdmin]  // Run left to right
}, async (request, reply) => {
  // request.user is set by authenticate
});
```

**Route Parameters vs Query**:
- Params: `/api/users/:id` — validated via `validateParams()`
- Query: `/api/products?categoryId=xyz` — validated via `validateQuery()`
- Body: POST/PUT — validated via `validateBody()`

**Multipart File Handling** (no Zod, manual parsing):

```typescript
app.post('/', async (request, reply) => {
  const fields: Record<string, string> = {};
  let avatarFile: { buffer: Buffer; mimetype: string } | undefined;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk);
      avatarFile = { buffer: Buffer.concat(chunks), mimetype: part.mimetype };
    } else if (part.type === 'field') {
      fields[part.fieldname] = part.value as string;
    }
  }

  // Validate fields manually or with Zod after parsing
  const user = await usersService.createUser(fields);
});
```

## Frontend Patterns

### TanStack Query for Server State

Use React Query (TanStack Query v5) for all server data:

```typescript
// pages/users.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

const useUsers = () => useQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const { data } = await api.get('/api/users');
    return data.users;
  },
});

const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/api/users', formData);
      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createMutation = useCreateUser();
  
  if (isLoading) return <Spinner />;
  
  return (
    <div>
      {users?.map(u => <UserRow key={u.id} user={u} />)}
      <CreateUserModal onCreate={createMutation.mutate} />
    </div>
  );
}
```

### Zustand for Auth State

Use Zustand (not Redux, not Context) for persistent auth state:

```typescript
// store/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    { name: 'auth-storage' }  // Persisted to localStorage
  ),
);

// In component
const user = useAuthStore(state => state.user);
const setUser = useAuthStore(state => state.setUser);
```

### Axios Interceptor for 401 Refresh

Automatic access token refresh on 401 (via `lib/axios.ts`):

```typescript
// lib/axios.ts already handles this
// Just use `api` for all requests:
const { data } = await api.get('/api/users');
// If access token expired:
// 1. axios detects 401
// 2. Calls /api/auth/refresh automatically
// 3. Retries original request
// 4. User doesn't notice
```

### Ant Design Components

Use Ant Design v6 components; avoid custom styling unless necessary:

```typescript
import { Button, Form, Input, Table, Modal, Upload } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

export function UserList() {
  return (
    <Table
      dataSource={users}
      columns={[
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        {
          title: 'Actions',
          render: (_, record) => (
            <>
              <Button icon={<EditOutlined />} onClick={() => openEditModal(record)} />
              <Button danger icon={<DeleteOutlined />} onClick={() => deleteUser(record.id)} />
            </>
          ),
        },
      ]}
    />
  );
}
```

### Form Handling

Use Ant Design Form for validation + submission:

```typescript
import { Form, Input, Button } from 'antd';

export function LoginForm() {
  const [form] = Form.useForm();
  const loginMutation = useLoginMutation();

  return (
    <Form form={form} onFinish={async (values) => {
      await loginMutation.mutateAsync(values);
    }}>
      <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
        <Input placeholder="Email" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, min: 6 }]}>
        <Input.Password placeholder="Password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loginMutation.isPending}>
        Login
      </Button>
    </Form>
  );
}
```

## Git Conventions

### Commit Messages

Format: `type(scope): description`

```
feat(users): add avatar upload to S3
fix(auth): refresh token rotation on concurrent requests
docs(readme): update environment variables
chore(deps): update drizzle to 0.32
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming

- Feature: `feature/user-avatar-upload`
- Fix: `fix/jwt-expiry-issue`
- Docs: `docs/api-endpoints`

### PR Guidelines

- One logical change per PR
- Include test case if adding behavior
- Update docs if API changes
- Squash commits before merge (optional, depends on team preference)

## Testing (Optional — Not in Scope Yet)

### Backend Unit Tests (When Added)

```typescript
// src/modules/auth/auth.service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as authService from './auth.service';

describe('authService', () => {
  it('should hash password with bcrypt', async () => {
    const user = await authService.createUser({
      email: 'test@example.com',
      password: 'secret123',
      name: 'Test User',
    });
    expect(user.passwordHash).not.toBe('secret123');
  });

  it('should throw if user already exists', async () => {
    await authService.createUser({ email: 'test@example.com', password: 'p', name: 'A' });
    await expect(
      authService.createUser({ email: 'test@example.com', password: 'p', name: 'B' })
    ).rejects.toThrow();
  });
});
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Fix |
|--------------|-----|-----|
| HTTP logic in service layer | Services should not know about requests/responses | Move HTTP concerns to routes |
| Validation in service layer | Validation is a route concern | Use Zod schemas + validateBody middleware |
| Async/await without try/catch | Unhandled promise rejections | Wrap in try/catch or let error handler catch |
| N+1 queries | For each user, fetch category separately | Use JOIN or batch queries |
| Any type | Loses TypeScript benefits | Use `unknown` or proper types |
| Direct database calls in routes | Couples routes to schema | Use services as abstraction |
| Storing secrets in .env files committed to git | Security risk | Use `.env.example` + `git ignore .env` |
| Fire-and-forget async operations | Errors silently lost | Explicitly handle or `void` with comment |

## Code Quality Tools

### TypeScript

```bash
npm run build    # Type check + compile
npx tsc --noEmit # Type check only
```

### Linting

```bash
npm run lint      # Check for style issues
npx eslint . --fix # Auto-fix
```

### Database Schema

```bash
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations to DB
npm run db:studio    # GUI for database (dev only)
```

## Summary

**Backend**: Module structure (schema → service → routes), Zod validation, error-handled services

**Frontend**: TanStack Query for server state, Zustand for auth, Ant Design for UI

**Shared**: Strict TypeScript, type imports, kebab-case files, camelCase exports
