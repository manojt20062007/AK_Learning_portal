# AK Learning Platform

> A professional paid online learning platform with UPI payment integration, HLS video streaming, student management, and admin controls.

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · HLS.js |
| Backend | Node.js · Express.js · TypeScript · REST API · Zod |
| Database | PostgreSQL 17 · Prisma ORM |
| Security | Argon2id · HTTP-only sessions · CSRF · Rate limiting · RBAC |
| Video | Cloudflare R2 · FFmpeg · HLS · Signed URLs |
| Monorepo | npm Workspaces |

## 📂 Project Structure

```
AkLearningPlatform/
├── apps/
│   ├── backend/          # Express API server (port 4000)
│   │   ├── src/
│   │   │   ├── config/   # DB, logger, env config
│   │   │   ├── middleware/ # Auth, CSRF, rate limit, error handler
│   │   │   └── routes/   # API routes
│   │   └── prisma/       # Schema + migrations + seed
│   └── frontend/         # Next.js app (port 3000)
│       └── src/app/      # Pages (App Router)
└── packages/
    └── shared/           # Shared Zod schemas + TypeScript types
```

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 17 (running on port 5433 locally)
- npm 10+

### 1. Clone & Install
```bash
npm install
```

### 2. Configure Environment
```bash
# Backend
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your database credentials

# Frontend
cp .env.example apps/frontend/.env.local
```

### 3. Set Up Database
```bash
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed admin + categories
```

### 4. Start Development
```bash
npm run dev           # Starts both backend (4000) and frontend (3000)
# OR individually:
npm run dev:backend
npm run dev:frontend
```

### 5. First Login
- URL: http://localhost:3000/login
- Admin: `admin@aklms.com` / `Admin@AK2024!`
- **Change password immediately after first login!**

## 🔑 API Endpoints (Phase 1)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Email + password login |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/setup-password` | First-time password setup |
| POST | `/api/auth/change-password` | Change own password |

### Admin (requires ADMIN role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Analytics overview |
| GET/POST | `/api/admin/courses` | List / create courses |
| GET/PATCH/DELETE | `/api/admin/courses/:id` | Course detail / update / delete |
| POST | `/api/admin/courses/:id/publish` | Publish course |
| POST | `/api/admin/courses/:id/archive` | Archive course |
| GET/POST | `/api/admin/categories` | List / create categories |
| GET/POST | `/api/admin/students` | List / create students |
| GET/PUT | `/api/admin/settings/upi` | UPI payment settings |
| GET | `/api/admin/audit` | Audit log |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/courses` | Public course listing |
| GET | `/api/public/courses/:slug` | Course detail page |
| GET | `/api/public/categories` | Active categories |
| GET | `/api/public/upi` | UPI payment info |

## 🗄️ Database Models (20 total)

User · StudentProfile · UserSession · PasswordResetToken · Category · Course · Section · Lesson · VideoAsset · LessonResource · CourseRequest · PaymentSubmission · Enrollment · LessonProgress · PlaybackSession · Quiz · Question · QuizOption · QuizAttempt · Certificate · Review · AdminAuditLog · Notification · PlatformSettings

## 🔒 Security

- **Passwords**: Argon2id (memoryCost=65536, timeCost=3, parallelism=4)
- **Sessions**: HTTP-only secure cookies via express-session + PostgreSQL store
- **Rate limiting**: 10 login attempts per 15 min, 200 API requests per 15 min
- **Role-based**: ADMIN and STUDENT roles enforced at middleware level
- **Audit log**: All admin actions recorded with IP + metadata

## 📋 Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 - Foundation | ✅ Complete | Monorepo, DB, Admin auth, Course CRUD |
| 2 - Payments | 🔜 Next | UPI flow, payment submissions, verification |
| 3 - Students | 🔜 Planned | Student accounts, invitations, dashboard |
| 4 - Video | 🔜 Planned | R2, FFmpeg, HLS, watermark |
| 5 - Learning | 🔜 Planned | Player, progress, PDFs |
| 6 - Quizzes | 🔜 Planned | Quizzes, certificates |
| 7 - Production | 🔜 Planned | Security audit, deploy |
