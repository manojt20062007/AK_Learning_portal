# AK Learning Platform — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AK Learning Platform                   │
├─────────────────┬──────────────────────────────────────-─┤
│   Frontend      │   Backend (Modular Monolith)            │
│   Next.js 15    │   Express + Prisma                      │
│   Port 3000     │   Port 4000                             │
│                 │                                         │
│  Public Pages   │  Auth Module                            │
│  Admin Dashboard│  Admin Module                           │
│  Student Panel  │  Student Module                         │
│  Video Player   │  Payment Module                         │
│                 │  Video Module                           │
│                 │  Notification Module                    │
└─────────────────┴────────────────────────────────────────┘
              ↕ REST API (HTTP-only cookies)
┌──────────────────────────────────────────────────────────┐
│                  PostgreSQL 17 (port 5433)                │
│            Managed via Prisma ORM                        │
└──────────────────────────────────────────────────────────┘
              ↕ Cloudflare R2 SDK (Phase 4)
┌──────────────────────────────────────────────────────────┐
│          Cloudflare R2 (Private Video Storage)            │
│         HLS segments + manifests (signed URLs)           │
└──────────────────────────────────────────────────────────┘
```

## Phase Breakdown

### PHASE 1 — Foundation ✅ COMPLETE
**Goal**: Working dev environment with admin auth and course management

| Task | Status |
|------|--------|
| Monorepo (npm workspaces) | ✅ |
| Backend: Express + TypeScript | ✅ |
| Frontend: Next.js 15 + Tailwind | ✅ |
| Shared: Zod schemas + types | ✅ |
| PostgreSQL + Prisma schema | ✅ |
| DB migration (20+ models) | ✅ |
| DB seed (admin + categories) | ✅ |
| Argon2id password hashing | ✅ |
| Session-based authentication | ✅ |
| Rate limiting (auth + API) | ✅ |
| Admin CRUD: courses | ✅ |
| Admin CRUD: categories | ✅ |
| Admin CRUD: students | ✅ |
| Admin dashboard API | ✅ |
| Public course listing API | ✅ |
| UPI settings API | ✅ |
| Audit logging | ✅ |
| TypeScript check: 0 errors | ✅ |
| API smoke tests: all pass | ✅ |

---

### PHASE 2 — Requests & Payments 🔜 NEXT
**Goal**: Complete payment flow from student request to admin approval

**Public Flow**:
1. Student visits `/courses/:slug` → clicks "Enroll"
2. Student fills request form (name, email, phone)
3. Student sees UPI QR + UPI ID
4. Student pays via Google Pay / PhonePe
5. Student submits UTR + payment date + optional screenshot
6. Status shows "Pending Verification"

**Admin Flow**:
1. Admin sees pending payment in dashboard
2. Admin manually verifies UTR in bank app
3. Admin clicks Approve → system creates student account
4. Admin clicks Reject → reason stored, student notified

**API Endpoints to Build**:
- `POST /api/public/course-request` — submit request
- `POST /api/public/payment` — submit payment with UTR
- `GET /api/public/payment/status/:ref` — check payment status
- `GET /api/admin/payments` — list all payments
- `GET /api/admin/payments/:id` — single payment detail
- `POST /api/admin/payments/:id/approve` — approve + create student
- `POST /api/admin/payments/:id/reject` — reject with reason

**Frontend Pages**:
- `/courses/:slug` — full course detail + enrollment CTA
- `/join/:courseId` — course request form
- `/pay/:requestId` — UPI payment page with QR
- `/payment-status/:ref` — submission confirmation
- `/admin/payments` — payment queue with approve/reject

---

### PHASE 3 — Student Management 🔜 PLANNED
**Goal**: Student accounts, invitations, and dashboard

**Features**:
- Admin creates student + assigns course
- Student ID generation (AKL-YYYY-NNNN)
- Password setup email with one-time link
- WhatsApp invite via link (wa.me deep link)
- Student login → dashboard
- Student profile page
- My Courses with progress

**API to Build**:
- `GET /api/student/dashboard`
- `GET /api/student/courses`
- `GET /api/student/courses/:id`
- `GET /api/student/profile`
- `PATCH /api/student/profile`
- `GET /api/student/notifications`

---

### PHASE 4 — Video Infrastructure 🔜 PLANNED
**Goal**: Secure 1080p video streaming via Cloudflare R2 + HLS

**Workflow**:
1. Admin uploads MP4 → backend receives + saves locally
2. FFmpeg transcodes: H.264, AAC, CRF 23–25, medium preset
3. FFmpeg segments: HLS (6s segments) → `.m3u8` + `.ts` files
4. Files uploaded to private Cloudflare R2 bucket
5. Object keys saved in `VideoAsset` table
6. On student playback request:
   - Verify auth + enrollment
   - Generate short-lived signed URLs (15 min) for manifest + segments
   - Return signed manifest URL to client
7. HLS.js plays stream
8. Moving watermark: Student ID overlaid via CSS/canvas

**FFmpeg Command**:
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -crf 23 -preset medium \
  -c:a aac -b:a 128k \
  -vf scale=1920:1080 \
  -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "seg_%03d.ts" \
  output.m3u8
```

**Security**:
- R2 bucket is PRIVATE (no public access)
- Signed URLs expire in 15 minutes
- Server verifies enrollment before generating URLs
- Signed URL per-request (not cacheable without auth)

**Limitations (Honest)**:
- R2 free tier: 10 GB/month storage, 1M Class A ops, 10M Class B ops
- 50+ hours at ~2.5 Mbps ≈ ~56 GB — **exceeds free tier**
- Budget ~\$0.015/GB-month for storage overage
- No DRM (Widevine/FairPlay) — HLS signed URLs are not DRM
- Screen recording cannot be blocked at OS level

---

### PHASE 5 — Learning Experience 🔜 PLANNED
- Course player with lesson sidebar
- PDF/resource downloads
- Lesson completion marking
- Section/course progress tracking
- Resume from last position

---

### PHASE 6 — Quizzes & Certificates 🔜 PLANNED
- Quiz builder (admin creates questions + options)
- Student quiz attempts
- Scoring (configurable passing %)
- PDF certificate generation
- Certificate verification page

---

### PHASE 7 — Production 🔜 PLANNED
- Security audit (OWASP checklist)
- Automated API tests
- Database backup strategy
- Server deployment (VPS or cloud)
- Domain + HTTPS
- Monitoring + uptime alerts

## Security Decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Passwords | Argon2id | OWASP recommended, memory-hard |
| Sessions | HTTP-only cookie + PG store | Prevents XSS token theft |
| Auth type | Server-side session | Simpler revocation than JWT |
| Payment | Manual UPI only | No Razorpay integration needed at launch |
| Video | Signed URLs (15 min) | Private R2, server-validated per request |
| DRM | None | Not cost-effective at this scale |
| Money | Integer paise | Avoids floating point errors |

## Database Migration Strategy

- Dev: `prisma migrate dev` (automatic)
- Staging/Prod: `prisma migrate deploy` (non-destructive)
- Seed only on fresh databases
- Never run `prisma migrate reset` on production
