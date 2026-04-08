---
spec_id: phase-05-frontend-modules
status: pending
acceptance_criteria:
  - Login page authenticates user and redirects to dashboard
  - Dashboard shows summary stats (total users, products, categories) with antd Statistic cards
  - Users page: table with search/pagination, create/edit modal with avatar upload, delete confirm
  - Products page: table with search/filter-by-category/pagination, create/edit modal with image upload
  - Categories page: table with search/pagination, create/edit modal, delete with warning
  - All CRUD operations reflect in UI immediately via TanStack Query cache invalidation
  - Form validation shows inline errors via antd Form rules
---

# Phase 5: Frontend Modules

## Context Links

- [Plan Overview](plan.md)
- Previous: [Phase 4 - Frontend Core](phase-04-frontend-core.md)
- Next: [Phase 6 - Docker & Infrastructure](phase-06-docker-infra.md)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 7h
- **Description**: Login page, Dashboard with stats, Users/Products/Categories CRUD pages with antd Table, Form modals, S3 image upload, search, pagination, TanStack Query integration

## Key Insights

- Each feature module follows pattern: `page.tsx` + `form-modal.tsx` + `service.ts` + `hooks.ts`
- antd `Table` handles pagination natively via `pagination` prop — sync with server-side pagination
- antd `Form` with `form.setFieldsValue()` for edit mode, `form.resetFields()` for create mode
- antd `Upload` component with `beforeUpload` returning false — manual upload via FormData in service
- TanStack Query `useMutation` + `queryClient.invalidateQueries` for optimistic-feeling CRUD
- Search: debounced input (300ms) updating query params -> refetch list

## Requirements

### Functional

**Login Page**
- Email + password form (antd Form + Input)
- Submit calls auth service -> set auth store -> redirect to `/dashboard`
- Show error message on invalid credentials (antd `message.error`)
- Centered card layout, simple branding

**Dashboard Page**
- 4 stat cards: Total Users, Total Products, Total Categories, Recent Activity count
- Stats fetched via dedicated endpoint or individual count queries
- antd `Card` + `Statistic` components in a responsive grid
- Optional: recent items list (last 5 products/users created)

**Users Page**
- antd `Table` with columns: Avatar (thumbnail), Name, Email, Created At, Actions
- Search input (debounced) filters by name/email
- Pagination synced with backend (page, limit, total)
- "Add User" button opens modal form
- Edit button opens modal pre-filled with user data
- Delete button with antd `Modal.confirm` confirmation
- Avatar upload in modal: antd `Upload` with image preview

**Products Page**
- antd `Table`: Image (thumbnail), Name, Price, Category, Created At, Actions
- Search + category filter dropdown (populated from `/categories/all`)
- Pagination synced with backend
- Create/edit modal: name, description (TextArea), price (InputNumber), category (Select), image upload
- Delete with confirmation

**Categories Page**
- antd `Table`: Name, Description, Created At, Actions
- Search + pagination
- Create/edit modal: name, description
- Delete with warning if products reference this category

### Non-Functional
- Loading skeletons on initial data fetch
- Disabled buttons during mutation (prevent double-submit)
- Toast notifications on CRUD success/failure (antd `message`)
- Responsive: table scrollable on mobile, modal full-width on small screens

## Architecture

### Feature Module Pattern

```
features/{module}/
  {module}-page.tsx           # Page component with Table + toolbar
  {module}-form-modal.tsx     # antd Modal + Form for create/edit
  {module}.service.ts         # API calls via axios instance
  use-{module}.ts             # TanStack Query hooks (useQuery, useMutation)
```

### Data Flow

```
Page -> useQuery (list) -> service.getList() -> axios -> backend
     -> useMutation (create/update/delete) -> service.create() -> axios -> backend
     -> onSuccess: invalidateQueries(['module']) -> refetch list
```

### Shared UI Components

```
components/ui/
  data-table.tsx              # Wrapper around antd Table with common config (optional)
  confirm-delete-modal.tsx    # Reusable delete confirmation
  image-upload.tsx            # antd Upload configured for single image
  search-input.tsx            # Debounced antd Input.Search
  page-header.tsx             # Title + action button layout
```

## Related Code Files

| Action | Path | Description |
|--------|------|-------------|
| Create | `frontend/src/features/auth/login-page.tsx` | Login form page |
| Create | `frontend/src/features/auth/auth.service.ts` | login, logout, refresh, getMe API calls |
| Create | `frontend/src/features/dashboard/dashboard-page.tsx` | Stats overview |
| Create | `frontend/src/features/dashboard/dashboard.service.ts` | Fetch stats |
| Create | `frontend/src/features/dashboard/use-dashboard.ts` | useQuery for stats |
| Create | `frontend/src/features/users/users-page.tsx` | Users table + toolbar |
| Create | `frontend/src/features/users/user-form-modal.tsx` | Create/edit modal |
| Create | `frontend/src/features/users/users.service.ts` | Users API calls |
| Create | `frontend/src/features/users/use-users.ts` | TanStack hooks |
| Create | `frontend/src/features/products/products-page.tsx` | Products table + toolbar |
| Create | `frontend/src/features/products/product-form-modal.tsx` | Create/edit modal |
| Create | `frontend/src/features/products/products.service.ts` | Products API calls |
| Create | `frontend/src/features/products/use-products.ts` | TanStack hooks |
| Create | `frontend/src/features/categories/categories-page.tsx` | Categories table + toolbar |
| Create | `frontend/src/features/categories/category-form-modal.tsx` | Create/edit modal |
| Create | `frontend/src/features/categories/categories.service.ts` | Categories API calls |
| Create | `frontend/src/features/categories/use-categories.ts` | TanStack hooks |
| Create | `frontend/src/components/ui/search-input.tsx` | Debounced search |
| Create | `frontend/src/components/ui/image-upload.tsx` | Single image upload |
| Create | `frontend/src/components/ui/page-header.tsx` | Page title + action |
| Create | `frontend/src/hooks/use-debounce.ts` | Debounce hook |

## Implementation Steps

### 1. Shared Hooks and Components

1. **`hooks/use-debounce.ts`**:
   ```typescript
   export function useDebounce<T>(value: T, delay = 300): T {
     const [debounced, setDebounced] = useState(value);
     useEffect(() => {
       const timer = setTimeout(() => setDebounced(value), delay);
       return () => clearTimeout(timer);
     }, [value, delay]);
     return debounced;
   }
   ```

2. **`components/ui/search-input.tsx`**:
   - antd `Input.Search` controlled component
   - Accepts `onSearch(value: string)` callback
   - Internal state + `useDebounce` -> calls `onSearch` on debounced value change
   - Placeholder: "Search..."

3. **`components/ui/image-upload.tsx`**:
   - antd `Upload` with `listType="picture-card"`, `maxCount={1}`
   - `beforeUpload` returns `false` (manual upload)
   - Shows preview of selected/existing image
   - Props: `value?: string` (existing image URL), `onChange: (file: File | null) => void`

4. **`components/ui/page-header.tsx`**:
   - Flex row: `<Typography.Title level={4}>` + right-aligned action slot (children)

### 2. Auth Feature

1. **`features/auth/auth.service.ts`**:
   ```typescript
   export const authService = {
     login: (data: { email: string; password: string }) => api.post('/auth/login', data),
     logout: () => api.post('/auth/logout'),
     refresh: () => api.post('/auth/refresh'),
     getMe: () => api.get<{ data: User }>('/auth/me'),
   };
   ```

2. **`features/auth/login-page.tsx`**:
   - Centered layout: `div` with flex center + antd `Card`
   - antd `Form` with email (Input) + password (Input.Password) fields
   - Form rules: email required + email format, password required + min 6
   - Submit: call `authService.login()` -> `useAuthStore.setUser(response.data.user)` -> `navigate('/dashboard')`
   - Error: `message.error('Invalid email or password')`
   - If already authenticated: redirect to `/dashboard`

### 3. Dashboard Feature

1. **`features/dashboard/dashboard.service.ts`**:
   - `getStats()`: fetch user count, product count, category count
   - Option A: dedicated `/api/dashboard/stats` endpoint (add to backend)
   - Option B: parallel calls to list endpoints with `limit=1` and use `total` from response
   - Recommend Option B to avoid new backend endpoint (YAGNI)

2. **`features/dashboard/use-dashboard.ts`**:
   ```typescript
   export function useDashboardStats() {
     return useQuery({
       queryKey: ['dashboard-stats'],
       queryFn: async () => {
         const [users, products, categories] = await Promise.all([
           usersService.getList({ page: 1, limit: 1 }),
           productsService.getList({ page: 1, limit: 1 }),
           categoriesService.getList({ page: 1, limit: 1 }),
         ]);
         return {
           totalUsers: users.data.total,
           totalProducts: products.data.total,
           totalCategories: categories.data.total,
         };
       },
     });
   }
   ```

3. **`features/dashboard/dashboard-page.tsx`**:
   - antd `Row` + `Col` grid (span 8 each on desktop, 24 on mobile)
   - 3 `Card` components with `Statistic` inside: users (UserOutlined), products (ShoppingOutlined), categories (AppstoreOutlined)
   - Loading: `Spin` or `Skeleton` while fetching

### 4. Users Feature

1. **`features/users/users.service.ts`**:
   ```typescript
   export const usersService = {
     getList: (params: { page: number; limit: number; search?: string }) =>
       api.get<PaginatedResponse<User>>('/users', { params }),
     getById: (id: string) => api.get<{ data: User }>(`/users/${id}`),
     create: (formData: FormData) => api.post('/users', formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
     }),
     update: (id: string, formData: FormData) => api.put(`/users/${id}`, formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
     }),
     remove: (id: string) => api.delete(`/users/${id}`),
   };
   ```

2. **`features/users/use-users.ts`**:
   - `useUsers(params)` — `useQuery(['users', params], ...)`
   - `useCreateUser()` — `useMutation` + `invalidateQueries(['users'])`
   - `useUpdateUser()` — same pattern
   - `useDeleteUser()` — same pattern
   - All mutations show `message.success`/`message.error` in `onSuccess`/`onError`

3. **`features/users/users-page.tsx`**:
   - State: `page`, `limit`, `search` (debounced)
   - `PageHeader` with title "Users" + "Add User" button
   - `SearchInput` updating `search` state
   - antd `Table` with columns:
     - Avatar: `<Avatar src={record.avatarUrl} />` or initials fallback
     - Name: text
     - Email: text
     - Created: formatted date (`dayjs` or `date-fns`)
     - Actions: Edit (Button) + Delete (Popconfirm)
   - `pagination` prop: `{ current: page, pageSize: limit, total, onChange }`

4. **`features/users/user-form-modal.tsx`**:
   - Props: `open`, `onClose`, `editUser?: User`
   - antd `Modal` + `Form`
   - Fields: Name (Input), Email (Input), Password (Input.Password, required only on create), Avatar (ImageUpload)
   - On submit: build `FormData`, append fields + file if changed
   - Call `useCreateUser` or `useUpdateUser` mutation
   - On success: `onClose()`, form reset
   - Edit mode: `form.setFieldsValue(editUser)` via `useEffect`

### 5. Products Feature

1. **`features/products/products.service.ts`**: Same pattern as users, with `multipart/form-data`

2. **`features/products/use-products.ts`**:
   - `useProducts(params)` — includes `categoryId` filter param
   - `useCreateProduct()`, `useUpdateProduct()`, `useDeleteProduct()`
   - Also: `useAllCategories()` — calls `categoriesService.getAll()` for dropdown options

3. **`features/products/products-page.tsx`**:
   - State: `page`, `limit`, `search`, `categoryId`
   - Toolbar: SearchInput + antd `Select` for category filter (populated from `useAllCategories`)
   - Table columns: Image (thumbnail Avatar), Name, Price (formatted currency), Category, Created, Actions
   - Price formatting: `${record.price.toFixed(2)}`

4. **`features/products/product-form-modal.tsx`**:
   - Fields: Name, Description (TextArea), Price (InputNumber, min 0, precision 2), Category (Select from `/categories/all`), Image (ImageUpload)
   - Category select: antd `Select` with `options` from `useAllCategories`

### 6. Categories Feature

1. **`features/categories/categories.service.ts`**:
   - Standard CRUD (no multipart — JSON only)
   - `getAll()`: calls `/categories/all` for unpaginated list

2. **`features/categories/use-categories.ts`**:
   - `useCategories(params)`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`

3. **`features/categories/categories-page.tsx`**:
   - Simplest CRUD page — no image, no filters beyond search
   - Table columns: Name, Description (truncated), Created, Actions
   - Delete: if backend returns warning about referencing products, show in confirmation

4. **`features/categories/category-form-modal.tsx`**:
   - Fields: Name (Input, required), Description (TextArea, optional)

### 7. Date Formatting Utility

- Use `dayjs` (already bundled with antd) for date formatting
- Create `lib/format.ts`:
  ```typescript
  import dayjs from 'dayjs';
  export const formatDate = (date: string) => dayjs(date).format('MMM D, YYYY');
  export const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  ```

## Todo List

- [ ] Create useDebounce hook
- [ ] Create SearchInput, ImageUpload, PageHeader shared components
- [ ] Build login page with auth service integration
- [ ] Build dashboard page with stat cards
- [ ] Build users page: table, search, pagination
- [ ] Build user form modal: create/edit with avatar upload
- [ ] Build products page: table, search, category filter, pagination
- [ ] Build product form modal: create/edit with image upload + category select
- [ ] Build categories page: table, search, pagination
- [ ] Build category form modal: create/edit
- [ ] Create TanStack Query hooks for all modules
- [ ] Add date/currency formatting utilities
- [ ] Test full CRUD flow for each module

## Success Criteria

- Login with valid credentials -> dashboard with correct stats
- Users: create user with avatar -> appears in table with thumbnail -> edit name -> delete removes from table
- Products: create product with image + category -> table shows image, price, category name -> filter by category works
- Categories: create -> edit -> delete (with warning if products exist)
- Search filters table in real-time (debounced)
- Pagination shows correct total and navigates pages
- All mutations show success/error toast notifications
- Forms validate inline before submission

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| antd Upload component quirks with manual upload | Medium | Use `beforeUpload={()=>false}` + track file in state, build FormData manually |
| TanStack Query cache invalidation timing | Low | `invalidateQueries` is async; wrap in `onSuccess` callback |
| Large image preview causing layout shift | Low | Fixed-size Avatar/Image component with object-fit cover |
| Form not resetting between create/edit switches | Medium | Call `form.resetFields()` in `useEffect` when `open` + `editUser` changes |

## Security Considerations

- **No raw HTML rendering** — all user data displayed via antd components (auto-escaped)
- **File type validation**: accept only `image/*` in Upload component + backend validates MIME
- **No token exposure**: all API calls use httpOnly cookies via `withCredentials`
- **Price input**: `InputNumber` prevents non-numeric input; backend validates with Zod

## Next Steps

- Phase 6: Docker + nginx + docker-compose for deployment
