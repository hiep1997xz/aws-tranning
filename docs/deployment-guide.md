# Deployment Guide

## Prerequisites

Before deploying, ensure:

1. **PostgreSQL 16+** installed and running
2. **AWS S3 bucket** created with public read access policy
3. **IAM user** with S3 permissions (PutObject, GetObject, DeleteObject)
4. **Node.js 20+** and npm 10+
5. **Docker & Docker Compose** (for containerized deployment)

## Pre-Deployment Checklist

### 1. AWS S3 Setup

**Create Bucket**:
```bash
aws s3 mb s3://your-bucket-name --region ap-southeast-1
```

**Set Bucket Policy** (allow public read, restrict write to app only):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Sid": "DenyAll",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["s3:*"],
      "Resource": "arn:aws:s3:::your-bucket-name/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::ACCOUNT_ID:user/app-user"
        }
      }
    }
  ]
}
```

**Enable CORS** (if serving from different domain):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 2. IAM User & Keys

**Create User**:
```bash
aws iam create-user --user-name crud-admin-app
```

**Attach Policy**:
```bash
aws iam attach-user-policy \
  --user-name crud-admin-app \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

**Generate Access Keys**:
```bash
aws iam create-access-key --user-name crud-admin-app
```

Save `AccessKeyId` and `SecretAccessKey` — you'll need them for `.env`.

### 3. PostgreSQL Database

**Create Database & User** (if not already done):
```bash
createdb crud_admin
createuser admin --encrypted --pwprompt  # Enter password: password (or change)
psql -c "ALTER ROLE admin WITH CREATEDB;"
```

**Verify Connection**:
```bash
psql postgresql://admin:password@localhost:5432/crud_admin -c "SELECT 1;"
```

## Local Development Setup

### Step 1: Clone & Install

```bash
git clone <repo>
cd aws-tranning

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Step 2: Configure Environment

Copy `.env.example` → `.env` and update:

```bash
# Database
DATABASE_URL=postgresql://admin:password@localhost:5432/crud_admin

# JWT (generate random strings, min 32 chars each)
JWT_ACCESS_SECRET=your-access-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-at-least-32-characters-long

# AWS S3 (from IAM setup above)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=your-bucket-name

# URLs
FRONTEND_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
```

### Step 3: Database Migrations

```bash
cd backend

# Generate migration files (if schema.ts changed)
npm run db:generate

# Apply migrations to PostgreSQL
npm run db:migrate

# Optional: open GUI to inspect database
npm run db:studio
```

### Step 4: Start Backend

```bash
cd backend
npm run dev
# Runs on http://localhost:3000
# Logs: [HH:MM:SS] INFO (12345): Server listening at http://0.0.0.0:3000
```

### Step 5: Start Frontend

In another terminal:

```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
# Open http://localhost:5173/login in browser
```

### Step 6: Test Locally

- Navigate to `http://localhost:5173/login`
- Create a test user via SQL: `INSERT INTO users (email, password_hash, name) VALUES ('test@example.com', 'hashed', 'Test User');`
- Or create via API: `curl -X POST http://localhost:3000/api/users -F email=test@example.com -F password=secret123 -F name=Test`
- Login and verify dashboard loads

## Docker Deployment

### Step 1: Build Images

```bash
cd aws-tranning
docker-compose build
```

### Step 2: Configure Environment (Docker)

Update `.env`:

```bash
# Same as local, but:
# - FRONTEND_URL should point to your domain (for CORS)
# - DATABASE_URL uses 'postgres' hostname (Docker internal)
DATABASE_URL=postgresql://admin:password@postgres:5432/crud_admin
FRONTEND_URL=http://localhost  # or https://yourdomain.com
NODE_ENV=production
```

### Step 3: Start Services

```bash
docker-compose up -d
```

Check status:
```bash
docker-compose ps
# Should show: postgres HEALTHY, backend running, frontend running
```

### Step 4: Run Migrations

```bash
docker-compose exec backend npm run db:migrate
```

### Step 5: Access Application

- Frontend: `http://localhost` (or your domain)
- Health check: `curl http://localhost/api/health`

### Logs

```bash
docker-compose logs -f backend      # Backend logs
docker-compose logs -f frontend     # Nginx logs
docker-compose logs -f postgres     # DB logs
```

### Cleanup

```bash
docker-compose down                 # Stop & remove containers
docker-compose down -v              # Also remove volumes (⚠️ deletes DB)
```

## Environment Variables Reference

| Variable | Purpose | Example | Notes |
|----------|---------|---------|-------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://admin:pwd@localhost:5432/crud_admin` | Change `localhost` to `postgres` in Docker |
| `JWT_ACCESS_SECRET` | Sign access tokens | Random string, ≥32 chars | Change in production |
| `JWT_REFRESH_SECRET` | Sign refresh tokens | Random string, ≥32 chars | Change in production |
| `AWS_REGION` | S3 region | `ap-southeast-1` | Must match bucket region |
| `AWS_ACCESS_KEY_ID` | IAM access key | From AWS Console | Rotate periodically |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | From AWS Console | Store securely, never commit |
| `S3_BUCKET_NAME` | S3 bucket name | `your-bucket-name` | Must exist and be accessible |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:5173` (dev) or `https://yourdomain.com` (prod) | Critical for security |
| `PORT` | Backend listen port | `3000` | Use 3000 for dev, 3000 for Docker (nginx proxies) |
| `NODE_ENV` | Environment mode | `development` or `production` | Affects cookie security (secure flag in prod) |

## Database Migrations

### Modify Schema

Edit `backend/src/db/schema/*.ts`:

```typescript
// Example: add column to users table
export const users = pgTable('users', {
  // ... existing columns
  phone: text('phone'),  // NEW
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Generate Migration

```bash
cd backend
npm run db:generate

# Creates migration file: migrations/YYYY-MM-DD_HH-MM-SS_auto.sql
# Preview migration before applying!
cat migrations/YYYY-MM-DD_HH-MM-SS_auto.sql
```

### Apply Migration

```bash
npm run db:migrate

# In Docker:
docker-compose exec backend npm run db:migrate
```

### Rollback (not automatic)

If migration breaks:
1. Manually edit migration SQL file
2. Reapply: `npm run db:migrate`

Drizzle doesn't auto-rollback; manage via Git + careful testing.

## Troubleshooting

### Cannot connect to PostgreSQL

**Local**:
```bash
# Check if running
psql -h localhost -U admin -d crud_admin -c "SELECT 1;"

# If fails, start:
brew services start postgresql  # macOS
sudo service postgresql start    # Linux
# or use Docker:
docker run -d -e POSTGRES_PASSWORD=password postgres:16-alpine
```

**Docker**:
```bash
# Wait 10-15s for postgres to be ready
docker-compose logs postgres

# Verify health:
docker-compose exec postgres pg_isready -U admin
```

### Backend cannot connect to PostgreSQL (Docker)

**Check network**:
```bash
docker-compose exec backend ping postgres
# Should reply (postgres is the hostname in Docker network)
```

**Check DATABASE_URL**:
```bash
# Should be:
DATABASE_URL=postgresql://admin:password@postgres:5432/crud_admin
# NOT: localhost — use service name 'postgres'
```

### 401 Unauthorized on API calls

**Check cookies**:
```javascript
// In browser console
document.cookie  // Should show 'access_token=...'
```

**Manual refresh**:
```bash
curl -c cookies.txt -b cookies.txt \
  -X POST http://localhost:3000/api/auth/refresh
```

**Clear cookies & login again**:
```javascript
// Browser console
document.cookie = "access_token=; Max-Age=0";
document.cookie = "refresh_token=; Max-Age=0";
// Then reload and login
```

### S3 Upload fails (403 Forbidden)

**Check IAM policy**:
```bash
aws iam get-user-policy --user-name crud-admin-app --policy-name ...
```

**Verify bucket exists**:
```bash
aws s3 ls s3://your-bucket-name/
```

**Check region**:
```bash
aws s3api get-bucket-location --bucket your-bucket-name
# Region should match AWS_REGION in .env
```

**Check AWS credentials**:
```bash
aws sts get-caller-identity  # Should return your IAM user
```

### Frontend stuck on loading / TanStack Query errors

**Check backend is running**:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

**Check CORS headers**:
```bash
curl -i http://localhost:3000/api/auth/me
# Look for: Access-Control-Allow-Origin: http://localhost:5173
```

**Clear browser cache**:
- DevTools → Storage → Clear All
- Or: Settings → Privacy → Clear browsing data

### File upload size limit exceeded

**Increase limit** in `backend/src/app.ts`:
```typescript
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
```

### Migrations fail (DB locked)

In Docker, restart PostgreSQL:
```bash
docker-compose restart postgres
docker-compose exec backend npm run db:migrate
```

## Production Checklist

Before deploying to production:

- [ ] Change JWT secrets to random, strong values (≥32 chars each)
- [ ] Set `NODE_ENV=production` (enables secure cookies: https-only)
- [ ] Update `FRONTEND_URL` to your domain (CORS)
- [ ] Enable HTTPS on nginx / ALB
- [ ] Run `npm run build` in backend & frontend (compiles TypeScript)
- [ ] Test login, CRUD, file upload flows
- [ ] Set up database backups (RDS automated backups or pg_dump)
- [ ] Monitor CloudWatch logs for errors
- [ ] Set up uptime monitoring (ping health endpoint)
- [ ] Document emergency runbook (rollback procedure)

## Scaling Beyond Single Docker Compose

### Multi-Instance Backend

Use AWS ECS or Kubernetes:
1. Push backend Docker image to ECR
2. Run multiple Fargate tasks
3. Place behind ALB (Application Load Balancer)
4. Add RDS PostgreSQL for shared DB
5. S3 bucket is already multi-region

### Database Connection Pooling

For 10+ backend instances, use PgBouncer:
```bash
docker run -d pgbouncer:latest  # Config: databases, users, etc.
# Backend DATABASE_URL points to pgbouncer (localhost:6432)
```

## Support & Debugging

### Enable Debug Logging

**Backend**:
```bash
# In backend/src/app.ts
const app = Fastify({ logger: true });  // Already enabled
```

**Frontend**:
```typescript
// In src/lib/axios.ts
api.interceptors.request.use(config => {
  console.log('Request:', config.method, config.url);
  return config;
});
```

### Common Commands

```bash
# Check service status
docker-compose ps

# View logs (tail last 50 lines)
docker-compose logs -f --tail=50 backend

# Execute command in container
docker-compose exec backend npm run db:studio

# Rebuild an image
docker-compose build --no-cache backend

# SSH into container
docker-compose exec backend sh
```

### Get Help

1. Check logs: `docker-compose logs -f backend`
2. Verify environment: `docker-compose config`
3. Test connectivity: `docker-compose exec backend ping postgres`
4. Review docs: `docs/system-architecture.md`, `docs/code-standards.md`
