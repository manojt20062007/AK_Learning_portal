import { Router } from 'express';
import argon2 from 'argon2';
import { prisma } from '../config/database';
import { LoginSchema } from '@ak-learning/shared';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiter';
import { requireAuth, getCurrentUserId } from '../middleware/auth';
import { AppError, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// POST /api/auth/login
router.post('/login', authRateLimiter, validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      studentProfile: {
        select: { studentId: true },
      },
    },
  });

  if (!user || !user.passwordHash) {
    // Use constant-time response to prevent timing attacks
    await argon2.verify(
      '$argon2id$v=19$m=65536,t=3,p=4$fake$fakehashfakehashfakehashfakehashfakehash',
      password,
    ).catch(() => {});
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = await argon2.verify(user.passwordHash, password);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
  }

  // Set session
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userName = user.name;

  logger.info(`User logged in: ${user.email} (${user.role})`);

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.studentProfile?.studentId ?? null,
    },
    message: 'Login successful',
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  logger.info(`User logged out: ${userId}`);

  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction error:', err);
    }
  });

  res.clearCookie('ak.sid');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      studentProfile: {
        select: {
          studentId: true,
          phone: true,
          profilePhoto: true,
        },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  res.json({ success: true, data: user });
});

// POST /api/auth/setup-password
router.post('/setup-password', async (req, res) => {
  const { token, password } = req.body as { token: string; password: string };

  if (!token || !password) {
    throw new AppError('Token and password are required', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw new AppError('Invalid or expired setup link. Please contact your administrator.', 400);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logger.info(`Password set up for user: ${resetToken.user.email}`);

  res.json({ success: true, message: 'Password set successfully. You can now log in.' });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  if (!currentPassword || !newPassword) {
    throw new AppError('Current and new password are required', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new AppError('No password set for this account', 400);
  }

  const isValid = await argon2.verify(user.passwordHash, currentPassword);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const passwordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  res.json({ success: true, message: 'Password changed successfully' });
});

export default router;
