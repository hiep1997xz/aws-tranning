---
spec_id: phase-04-frontend-core
status: pending
acceptance_criteria:
  - TailwindCSS and antd coexist without style conflicts (@layer + StyleProvider)
  - Axios instance with 401 interceptor retries failed requests after refresh
  - React Router with ProtectedRoute redirects unauthenticated users to /login
  - Zustand auth store persists user state across page reloads
  - TanStack Query client configured with sensible defaults
  - AppLayout renders sidebar navigation + header with user info + logout
---

# Phase 4: Frontend Core

## Context Links

- [Plan Overview](plan.md)
- Previous: [Phase 3 - Backend Modules](phase-03-backend-modules.md)
- Next: [Phase 5 - Frontend Modules](phase-05-frontend-modules.md)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 5h
- **Description**: Vite + React setup with TailwindCSS + antd coexistence, Axios interceptors with refresh retry queue, React Router with route protection, Zustand auth store, TanStack Query, AppLayout with sidebar

## Key Insights

- antd v5 uses CSS-in-JS (cssinjs) — coexistence with Tailwind requires `@layer` ordering + `StyleProvider` with `layer: true`
- Axios interceptor must queue concurrent 401 retries: only one refresh call, all queued requests retry after
- Zustand persist middleware stores auth user in localStorage (not token — token is httpOnly cookie)
- TanStack Query handles server cache; Zustand only for auth state (no overlap)
- antd ConfigProvider for theme customization (primary color, border radius)

## Requirements

### Functional
- TailwindCSS utility classes work alongside antd components without conflicts
- Axios instance at `/api` base URL, credentials included, 401 retry logic
- Router: `/login` (public), `/` redirect to `/dashboard`, all other routes protected
- Auth store: `user`, `isAuthenticated`, `login()`, `logout()`, `setUser()`
- AppLayout: collapsible sidebar with menu items, header with user name + logout button
- TanStack Query: default staleTime 30s, retry 1

### Non-Functional
- No full-page flash on refresh (check auth state before rendering protected routes)
- Responsive sidebar (collapsible on small screens)
- Consistent antd theme across all components

## Architecture

### Style Layer Strategy

```css
/* index.css */
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
  <ConfigProvider theme={...}>
    <App />
  </ConfigProvider>
</StyleProvider>
```

This ensures antd styles sit in the `antd` layer, Tailwind base in `tailwind-base` layer, and Tailwind utilities (unlayered) always win specificity.

### Axios 401 Retry Queue

```
Request fails with 401
  -> Is refresh already in progress?
     YES -> Queue this request's retry promise
     NO  -> Set refreshing=true
         -> POST /api/auth/refresh
           -> Success: retry all queued requests + this one
           -> Failure: clear auth store, redirect to /login
         -> Set refreshing=false
```

### Router Structure

```
/login              -> LoginPage (public)
/                   -> redirect to /dashboard
/dashboard          -> DashboardPage (protected)
/users              -> UsersPage (protected)
/products           -> ProductsPage (protected)
/categories         -> CategoriesPage (protected)
```

### Component Tree

```
<StyleProvider layer>
  <ConfigProvider theme>
    <QueryClientProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </ConfigProvider>
</StyleProvider>
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| Create | `frontend/src/lib/axios.ts` | Axios instance + 401 interceptor |
| Create | `frontend/src/lib/query-client.ts` | TanStack Query client |
| Create | `frontend/src/store/auth-store.ts` | Zustand auth store with persist |
| Create | `frontend/src/router/index.tsx` | Route definitions |
| Create | `frontend/src/router/protected-route.tsx` | Auth guard component |
| Create | `frontend/src/components/layout/app-layout.tsx` | Sidebar + header + Outlet |
| Create | `frontend/src/components/layout/sidebar.tsx` | antd Menu with nav items |
| Create | `frontend/src/components/layout/app-header.tsx` | User info + logout |
| Create | `frontend/src/types/api.ts` | Shared API response types |
| Create | `frontend/src/types/entities.ts` | User, Product, Category types |
| Modify | `frontend/src/index.css` | @layer setup for Tailwind + antd |
| Modify | `frontend/src/main.tsx` | StyleProvider + ConfigProvider + QueryClient + Router |
| Modify | `frontend/src/App.tsx` | Replace with router rendering |
| Modify | `frontend/tailwind.config.js` | Ensure content paths correct |

## Implementation Steps

### 1. TypeScript Types (`types/`)

1. **`types/entities.ts`**:
   ```typescript
   export interface User {
     id: string;
     email: string;
     name: string;
     avatarUrl: string | null;
     createdAt: string;
     updatedAt: string;
   }

   export interface Product {
     id: string;
     name: string;
     description: string | null;
     price: number;
     categoryId: string | null;
     categoryName: string | null;
     imageUrl: string | null;
     createdAt: string;
     updatedAt: string;
   }

   export interface Category {
     id: string;
     name: string;
     description: string | null;
     createdAt: string;
     updatedAt: string;
   }
   ```

2. **`types/api.ts`**:
   ```typescript
   export interface PaginatedResponse<T> {
     data: T[];
     total: number;
     page: number;
     limit: number;
     totalPages: number;
   }

   export interface ApiError {
     error: string;
     message: string;
     details?: Record<string, string[]>;
   }
   ```

### 2. TailwindCSS + antd Coexistence

1. **`src/index.css`**:
   ```css
   @layer tailwind-base, antd;

   @layer tailwind-base {
     @tailwind base;
   }

   @tailwind components;
   @tailwind utilities;
   ```

2. **`tailwind.config.js`**: Verify `content` includes `./src/**/*.{ts,tsx}`

### 3. Axios Instance (`lib/axios.ts`)

1. Create axios instance:
   ```typescript
   const api = axios.create({
     baseURL: '/api',
     withCredentials: true,
     headers: { 'Content-Type': 'application/json' },
   });
   ```

2. Response interceptor:
   - Track `isRefreshing` flag and `failedQueue` array
   - On 401: if not refreshing, call `POST /api/auth/refresh`
   - On refresh success: replay all queued requests
   - On refresh failure: clear auth store, `window.location.href = '/login'`
   - Skip retry for `/auth/refresh` and `/auth/login` endpoints (prevent infinite loop)

### 4. TanStack Query Client (`lib/query-client.ts`)

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 5. Zustand Auth Store (`store/auth-store.ts`)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' },
  ),
);
```

### 6. Router (`router/`)

1. **`router/protected-route.tsx`**:
   - Check `useAuthStore().isAuthenticated`
   - If not authenticated: check `/api/auth/me` (handles page refresh with valid cookie)
   - Show loading spinner during check
   - Redirect to `/login` if not authenticated
   - Render `<Outlet />` if authenticated

2. **`router/index.tsx`**:
   - Define all routes per architecture above
   - Lazy-load page components with `React.lazy` + `Suspense` (optional, YAGNI for now — just direct imports)

### 7. Layout Components

1. **`components/layout/sidebar.tsx`**:
   - antd `Menu` component with `mode="inline"`
   - Items: Dashboard (DashboardOutlined), Users (UserOutlined), Products (ShoppingOutlined), Categories (AppstoreOutlined)
   - Use `useLocation()` for `selectedKeys`
   - Use `useNavigate()` on menu item click

2. **`components/layout/app-header.tsx`**:
   - antd `Header` from Layout
   - Left: sidebar collapse toggle button
   - Right: user name display + antd `Dropdown` with Logout option
   - Logout: call `POST /api/auth/logout`, clear auth store, navigate to `/login`

3. **`components/layout/app-layout.tsx`**:
   - antd `Layout` with `Sider` (sidebar) + `Layout` (content area)
   - `Sider` collapsible with `collapsed` state
   - Content area: `AppHeader` + `Content` wrapping `<Outlet />`
   - Min height `100vh`

### 8. Main Entry (`main.tsx`)

```tsx
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { AppRouter } from './router';
import './index.css';

const theme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider layer>
      <ConfigProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
);
```

## Todo List

- [ ] Create TypeScript entity and API types
- [ ] Set up TailwindCSS + antd `@layer` coexistence in index.css
- [ ] Create Axios instance with 401 retry queue interceptor
- [ ] Create TanStack Query client
- [ ] Create Zustand auth store with persist
- [ ] Create ProtectedRoute with `/auth/me` check on refresh
- [ ] Create AppLayout with collapsible sidebar + header
- [ ] Create Sidebar with menu items + active state
- [ ] Create AppHeader with user info + logout dropdown
- [ ] Wire main.tsx with all providers
- [ ] Define router with all routes
- [ ] Verify: Tailwind utilities override antd defaults correctly
- [ ] Verify: 401 on expired token triggers refresh and retries original request

## Success Criteria

- Tailwind class `bg-red-500` visually overrides antd background on any antd component
- Navigate to `/dashboard` when not logged in -> redirect to `/login`
- After login, refresh page -> stay on protected route (cookie persists, `/me` succeeds)
- Sidebar highlights current route, navigation works
- Logout clears state + redirects to login
- Concurrent 401s result in single refresh call, all retried

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailwind + antd specificity war | High | `@layer` strategy tested in step 2; fallback: `!important` on Tailwind utilities |
| 401 retry infinite loop | High | Skip interceptor for `/auth/refresh` and `/auth/login` URLs |
| Stale auth state after refresh token expires | Medium | ProtectedRoute calls `/me` on mount; interceptor redirects on refresh failure |
| antd `ConfigProvider` not applying to all components | Low | Wrap at root level in main.tsx |

## Security Considerations

- **No tokens in JS**: access/refresh tokens are httpOnly cookies — JS never reads them
- **Zustand stores user profile only** — not secrets
- **`withCredentials: true`** on Axios — cookies sent automatically
- **CORS**: backend must allow `FRONTEND_URL` origin with credentials
- **localStorage for auth store**: only stores `{ user, isAuthenticated }` — acceptable risk for admin panel; tokens remain httpOnly

## Next Steps

- Phase 5: Build login page + all CRUD feature pages
