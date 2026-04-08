# React + Vite + TypeScript + Antd v5 Admin Dashboard — Best Practices

Date: 2026-04-08

---

## 1. TailwindCSS v3 + Antd v5 Coexistence

**Root cause of conflict:** Both inject global/base styles. Tailwind's `base` layer (`@tailwind base`) resets browser defaults and collides with antd's own CSS-in-JS styles.

**Official antd v5 fix (from ant.design/docs/react/compatible-style):**

```css
/* src/index.css */
@layer tailwind-base, antd;

@layer tailwind-base {
  @tailwind base;
}
@tailwind components;
@tailwind utilities;
```

```tsx
// main.tsx
import { StyleProvider } from '@ant-design/cssinjs';

<StyleProvider layer>
  <ConfigProvider>
    <App />
  </ConfigProvider>
</StyleProvider>
```

**How it works:** `@layer` order ensures antd styles always win over Tailwind base resets. StyleProvider's `layer` prop wraps antd CSS-in-JS into `@layer antd`, making it lower-specificity than Tailwind utilities — so Tailwind utilities override antd where intentional.

**Do NOT add Tailwind prefix (`tw-`) unless you have a pre-existing CSS codebase collision.** It forces rewriting every class and adds zero benefit in a greenfield project.

**Purge config** — antd CSS-in-JS generates styles at runtime, nothing to purge. Just configure `content` paths normally:

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }, // disable if @layer strategy is insufficient
};
```

If `@layer` alone doesn't fully resolve conflicts (rare edge cases), set `corePlugins: { preflight: false }` to disable Tailwind's base reset entirely.

---

## 2. Folder Structure

```
src/
├── assets/                  # images, fonts
├── components/              # shared reusable UI (not page-specific)
│   ├── layout/              # AppLayout, Sidebar, Header
│   └── ui/                  # PageHeader, DataTable, ConfirmModal wrappers
├── features/                # feature-scoped: pages + hooks + api per domain
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── use-auth-store.ts
│   │   └── auth.service.ts
│   ├── users/
│   │   ├── UsersPage.tsx
│   │   ├── UserFormModal.tsx
│   │   ├── use-users.ts      # React Query hooks
│   │   └── users.service.ts  # axios calls
│   ├── products/
│   └── categories/
├── hooks/                   # global custom hooks (useDebounce, usePermission)
├── lib/
│   ├── axios.ts             # axios instance + interceptors
│   └── query-client.ts      # TanStack QueryClient config
├── router/
│   ├── index.tsx            # createBrowserRouter, route tree
│   └── ProtectedRoute.tsx
├── store/                   # global Zustand stores (auth only)
├── types/                   # shared TS interfaces
└── main.tsx
```

Key decisions: feature-colocation (files that change together live together) > technical grouping (all hooks in one folder). Services are thin axios wrappers; business logic lives in React Query hooks.

---

## 3. State Management: Zustand (recommended)

**Recommendation: Zustand** for auth state.

| Criterion | React Context | Zustand |
|---|---|---|
| Re-render scope | All consumers re-render on any change | Selector-based, only subscribed slice re-renders |
| Boilerplate | Provider + reducer + actions | One `create()` call |
| DevTools | None | Built-in Redux DevTools support |
| Persistence | Manual | `zustand/middleware` persist to localStorage |
| Bundle size | 0 (built-in) | ~1KB |

For a small-medium admin app, Context re-render issue is manageable, but Zustand's persistence middleware is the decisive factor for auth — storing user/role after page reload is trivial:

```ts
// store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'auth-store' }
  )
);
```

Note: persist stores non-sensitive user metadata (name, role) only. JWT stays in httpOnly cookie — NOT in localStorage/Zustand.

---

## 4. Auth Flow: JWT in httpOnly Cookie + 401 Retry

**Storage:** Set JWT as httpOnly cookie from server (`Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`). Never store in localStorage.

**Axios interceptor — 401 refresh with queued retry:**

```ts
// lib/axios.ts
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve()
  );
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) =>
        failedQueue.push({ resolve, reject })
      ).then(() => api(original));
    }
    original._retry = true;
    isRefreshing = true;
    try {
      await api.post('/auth/refresh'); // cookie-based, no body needed
      processQueue(null);
      return api(original);
    } catch (err) {
      processQueue(err);
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);
```

Queue pattern prevents duplicate refresh calls when multiple requests fail simultaneously.

---

## 5. Antd v5 ConfigProvider Theming

```tsx
// main.tsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
      fontFamily: 'Inter, sans-serif',
    },
    components: {
      Button: { borderRadius: 4 },
      Table: { headerBg: '#fafafa' },
    },
    algorithm: theme.defaultAlgorithm, // or theme.darkAlgorithm
  }}
>
```

- Use `token` for global design tokens (colors, spacing, radius)
- Use `components` for per-component overrides — avoids global CSS overrides
- Swap `algorithm` for dark mode: `theme.darkAlgorithm`
- Never override antd via external CSS classes — use component tokens

---

## 6. Form Handling: antd Form (recommended)

**Recommendation: antd Form (`Form` + `Form.Item` + `useForm`)**, not React Hook Form + antd.

**Why antd Form wins here:**
- Native integration with all antd input components (DatePicker, Select, Upload, etc.) — RHF requires `Controller` wrapper for every controlled antd component
- `Form.List` for dynamic fields, `Form.useWatch` for dependent fields — all built-in
- Validation rules via `rules` prop use same async/sync pattern as server validation
- `modal.confirm` + antd Form + `setFieldsValue` for edit modals is the idiomatic pattern

**Only reach for RHF when:** complex cross-field validation logic where Zod schema is needed, or you have non-antd inputs (rare in a full antd dashboard).

```tsx
const [form] = Form.useForm<UserFormValues>();
// Edit modal: pre-populate
useEffect(() => {
  if (editingRecord) form.setFieldsValue(editingRecord);
  else form.resetFields();
}, [editingRecord]);
```

---

## 7. React Query for Server State

```ts
// features/users/use-users.ts
export const useUsers = (params: UsersParams) =>
  useQuery({ queryKey: ['users', params], queryFn: () => usersService.list(params) });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
```

- `queryKey` always includes filter params for correct cache segmentation
- `invalidateQueries` on mutation success — no manual cache updates for CRUD
- Global error handling via `QueryClient` `onError` callback, not per-query

---

## Unresolved Questions

1. **Refresh token storage**: If server can't set httpOnly cookie (e.g., CORS/CDN constraints), what's the fallback? Memory storage (module-level variable) is the next-best option but lost on page reload.
2. **Antd v5 vs v6**: The official docs fetched are for v6. Verify `StyleProvider layer` prop and `@layer` support exists in antd v5 — it does (added in v5.17.0), but double-check package version.
3. **Role-based routing**: ProtectedRoute structure for multi-role admin (admin vs viewer) — not covered; depends on RBAC requirements.
