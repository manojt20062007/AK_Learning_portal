import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

import { env } from './config/env';
import { logger } from './config/logger';
import { globalErrorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';

// Routes
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import publicRouter from './routes/public';
import paymentRouter from './routes/payment';
import studentRouter from './routes/student';
import videoRouter from './routes/video';

const app = express();
app.disable('x-powered-by');
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ---- Session store ----
const PgSession = connectPgSimple(session);
const pgPool = new Pool({ connectionString: env.DATABASE_URL });

// ---- Security middleware ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  }),
);

// ---- Body parsing ----
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.SESSION_SECRET));

// ---- Session ----
app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: 'user_sessions_store',
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'ak.sid',
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: env.NODE_ENV === 'production' ? env.COOKIE_DOMAIN : undefined,
    },
  }),
);

// ---- Logging ----
if (env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    }),
  );
}

// ---- Rate limiting ----
app.use('/api/', apiRateLimiter);

// ---- Health check (with DB connectivity probe) ----
app.get('/health', async (_req, res) => {
  try {
    const { prisma } = await import('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString(), env: env.NODE_ENV });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// ---- API Routes ----
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/student', studentRouter);
app.use('/api/video', videoRouter);
app.use('/api/public', publicRouter);
app.use('/api/public', paymentRouter);

// ---- 404 handler ----
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ---- Global error handler ----
app.use(globalErrorHandler);

// ---- Start server ----
const PORT = env.PORT;
app.listen(PORT, () => {
  logger.info(`🚀 AK Learning Platform API running on http://localhost:${PORT}`);
  logger.info(`   Environment: ${env.NODE_ENV}`);
});

export default app;
