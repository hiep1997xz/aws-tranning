# Docker & Docker Compose Best Practices — React/Vite + Node/Express + PostgreSQL 16

Date: 2026-04-08

---

## 1. Node.js Backend — Multi-Stage Dockerfile

```dockerfile
# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev          # install prod deps only; omit devDependencies
COPY . .
# if you have a build step (TypeScript, bundling):
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
# copy only what's needed
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Key points:
- `npm ci --omit=dev` keeps node_modules lean in runtime image
- Non-root `app` user — required by Docker security rules
- If no build step (plain JS), skip `RUN npm run build` and copy `src/` directly

---

## 2. React/Vite Frontend — Multi-Stage Dockerfile + nginx

```dockerfile
# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # outputs to /app/dist

# ---- runtime stage ----
FROM nginx:1.25-alpine AS runtime
# copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html
# copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 3. nginx.conf — SPA + API Proxy

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # API proxy → backend service
    location /api/ {
        proxy_pass         http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA fallback — all non-asset routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Note: `proxy_pass http://backend:3000/` — trailing slash strips `/api` prefix before forwarding.
Match your Vite `base` config if it's not `/`.

---

## 4. docker-compose.yml

```yaml
services:

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      NODE_ENV: production
    ports:
      - "3000:3000"      # expose only if direct backend access needed; remove for frontend-only
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 5. .env File Pattern

`.env` (git-ignored):
```
POSTGRES_DB=myapp
POSTGRES_USER=myapp_user
POSTGRES_PASSWORD=supersecret

# S3 (passed to backend via env_file)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket
```

`.env.example` (committed):
```
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
```

Rules:
- `env_file: .env` loads all vars into container env
- Never embed secrets in Dockerfile `ENV` — they bake into image layers
- `${VAR}` in compose interpolates from shell env or `.env` at compose level

---

## 6. .dockerignore (both services)

```
node_modules
dist
.git
*.log
.env
.env.*
coverage
```

---

## 7. PostgreSQL Data Persistence

Named volume `postgres_data` maps to `/var/lib/postgresql/data`. Survives `docker compose down`; destroyed only by `docker compose down -v`. Never use bind-mount (`./data:/var/lib/postgresql/data`) in production — permission issues on Linux hosts.

---

## Summary — Service Dependency Chain

```
postgres (healthcheck) → backend → frontend
```

- `service_healthy` condition on postgres ensures backend waits for DB ready, not just container started
- `start_period: 10s` gives PostgreSQL time to initialize before retries count

---

## Unresolved Questions

- Does the backend need to be reachable directly (exposed port 3000)? If frontend proxies all traffic, remove port mapping.
- Is there a need for SSL termination at nginx level, or handled upstream (ALB/CloudFront on AWS)?
- Vite `base` config: if set to a subpath (e.g., `/app/`), nginx `location /` and `proxy_pass` must align.
- AWS credentials: prefer IAM roles (ECS task role / EC2 instance profile) over hardcoded keys — no env vars needed for S3 on AWS infra.
