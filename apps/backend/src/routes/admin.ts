import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';

// Sub-routers
import coursesRouter from './admin/courses';
import categoriesRouter from './admin/categories';
import studentsRouter from './admin/students';
import settingsRouter from './admin/settings';
import auditRouter from './admin/audit';
import paymentsRouter from './admin/payments';
import videosRouter from './admin/videos';
import quizzesRouter from './admin/quizzes';
import liveRouter from './admin/live';

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);

router.use('/courses', coursesRouter);
router.use('/categories', categoriesRouter);
router.use('/students', studentsRouter);
router.use('/settings', settingsRouter);
router.use('/audit', auditRouter);
router.use('/payments', paymentsRouter);
router.use('/videos', videosRouter);
router.use('/quizzes', quizzesRouter);
router.use('/live', liveRouter);

// GET /api/admin/dashboard - Analytics overview
router.get('/dashboard', async (req, res) => {
  const { prisma } = await import('../config/database');

  const [
    totalStudents,
    activeStudents,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    pendingPayments,
    recentStudents,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
    prisma.course.count(),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
    prisma.paymentSubmission.count({ where: { status: 'PENDING' } }),
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        studentProfile: { select: { studentId: true } },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      students: { total: totalStudents, active: activeStudents },
      courses: { total: totalCourses, published: publishedCourses },
      enrollments: { active: totalEnrollments },
      payments: { pending: pendingPayments },
      recentStudents,
    },
  });
});

export default router;
