import { Router } from 'express';
import { prisma } from '../../config/database';

const router = Router();

// GET /api/admin/audit - Get audit logs
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const action = req.query.action as string | undefined;

  const where = action ? { action: action as never } : {};

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export default router;
