import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import { UserRole } from '@prisma/client';

// Extend express session type
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: UserRole;
    userName?: string;
  }
}

async function verifySession(req: Request) {
  if (!req.session.userId) {
    throw new UnauthorizedError();
  }

  // Verify user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, role: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    throw new UnauthorizedError('Your account has been deactivated');
  }

  // Keep session data fresh
  req.session.userRole = user.role;
  req.session.userName = user.name;
  return user;
}

/**
 * Middleware: Requires a valid session (any authenticated user)
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  await verifySession(req);
  next();
}

/**
 * Middleware: Requires ADMIN role
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = await verifySession(req);
  if (user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Admin access required');
  }
  next();
}

/**
 * Middleware: Requires STUDENT role
 */
export async function requireStudent(req: Request, _res: Response, next: NextFunction) {
  const user = await verifySession(req);
  if (user.role !== UserRole.STUDENT) {
    throw new ForbiddenError('Student access required');
  }
  next();
}

/**
 * Helper: Get current user ID from session (throws if not authenticated)
 */
export function getCurrentUserId(req: Request): string {
  if (!req.session.userId) {
    throw new UnauthorizedError();
  }
  return req.session.userId;
}
