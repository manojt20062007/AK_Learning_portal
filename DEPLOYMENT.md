# Production Deployment & Operations Guide

## 1. Pre-Deployment Security Checklist
- [ ] Generate strong 64+ character `SESSION_SECRET` and `CSRF_SECRET`
- [ ] Change the seeded admin password (`admin@aklms.com`) immediately after first login
- [ ] Set `NODE_ENV="production"` and `CORS_ORIGIN="https://yourdomain.com"`
- [ ] Set `COOKIE_DOMAIN="yourdomain.com"` (HTTPS required for `secure: true` session cookies)
- [ ] Never commit `.env` or `.env.local` files to Git

## 2. Database & Migrations
```bash
cd apps/backend
npx prisma migrate deploy
```
- Never run `prisma migrate reset` in production.
- Schedule daily backups using `scripts/backup-db.sh` (Linux cron) or `scripts/backup-db.ps1` (Windows Task Scheduler).

## 3. Cloudflare R2 (Private Video Storage)
- Create a **private** R2 bucket (do NOT enable public `r2.dev` access).
- Configure R2 bucket CORS to allow `GET` requests from `https://yourdomain.com` so `hls.js` can fetch presigned `.ts` segment URLs directly from R2.
- Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` in `apps/backend/.env`.
- Monitor storage in `/admin/videos` — R2 free tier is 10 GB-month; 50+ hours of 1080p video (~50–65 GB) will require paid storage overage (~$0.015/GB-month).

## 4. Brevo SMTP (Student Invitations)
- In Brevo: **SMTP & API → SMTP**, create an SMTP key and set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`.
- WhatsApp invitations are generated as pre-typed `wa.me` links for manual sending from `/admin/students` and `/admin/payments`.

## 5. Build & Process Management
```bash
npm run build
```
Run behind Nginx or Caddy with HTTPS termination:
- `https://yourdomain.com` → Next.js (`apps/frontend`, port 3000)
- `https://api.yourdomain.com` (or `/api` proxy) → Express (`apps/backend`, port 4000)

## 6. Monitoring
- Point uptime monitors (e.g. UptimeRobot / Better Stack) at `GET /health`.
- Returns `200 {"status":"ok","database":"connected"}` when healthy, `503` if PostgreSQL is unreachable.
