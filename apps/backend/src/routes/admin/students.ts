import { Router } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { NotFoundError, AppError, ConflictError } from '../../middleware/errorHandler';
import { getCurrentUserId } from '../../middleware/auth';
import { logger } from '../../config/logger';
import { sendStudentInvitationEmail } from '../../services/email';
import { buildWhatsAppInvite } from '../../services/whatsapp';

const router = Router();

// Generate a unique student ID: AKL-YYYY-NNNN
async function generateStudentId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AKL-${year}-`;

  const lastProfile = await prisma.studentProfile.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: 'desc' },
  });

  let nextNum = 1;
  if (lastProfile) {
    const lastNum = parseInt(lastProfile.studentId.split('-')[2] || '0', 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// GET /api/admin/students
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const search = (req.query.search as string) || '';

  const where = search
    ? {
        role: 'STUDENT' as const,
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { studentProfile: { studentId: { contains: search, mode: 'insensitive' as const } } },
        ],
      }
    : { role: 'STUDENT' as const };

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        studentProfile: {
          include: {
            enrollments: {
              include: { course: { select: { title: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: students,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/admin/students/:id
router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id, role: 'STUDENT' },
    include: {
      studentProfile: {
        include: {
          enrollments: {
            include: {
              course: { select: { id: true, title: true, thumbnailUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!user) throw new NotFoundError('Student');
  res.json({ success: true, data: user });
});

// POST /api/admin/students - Create student account
router.post('/', async (req, res) => {
  const adminId = getCurrentUserId(req);
  const { name, email, phone, courseId, sendInviteEmail } = req.body as {
    name: string;
    email: string;
    phone: string;
    courseId?: string;
    sendInviteEmail?: boolean;
  };

  if (!name || !email || !phone) {
    throw new AppError('Name, email, and phone are required', 400);
  }

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) throw new ConflictError('A user with this email already exists');

  // Validate course if provided
  let courseTitle: string | undefined;
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (!course) throw new NotFoundError('Course');
    courseTitle = course.title;
  }

  // Generate student ID
  const studentId = await generateStudentId();

  // Generate password setup token
  const setupToken = randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create user, student profile, and optional enrollment in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role: 'STUDENT',
        isActive: true,
        studentProfile: {
          create: {
            studentId,
            phone: phone.trim(),
          },
        },
        passwordResetTokens: {
          create: {
            token: setupToken,
            expiresAt: tokenExpiry,
          },
        },
      },
      include: { studentProfile: true },
    });

    // Create enrollment if course specified
    if (courseId && newUser.studentProfile) {
      await tx.enrollment.create({
        data: {
          studentProfileId: newUser.studentProfile.id,
          courseId,
          status: 'ACTIVE',
        },
      });

      // Update enrollment count
      await tx.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      });
    }

    // Audit log
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: 'STUDENT_CREATED',
        entityType: 'User',
        entityId: newUser.id,
        description: `Created student account: ${name} (${studentId})`,
      },
    });

    return newUser;
  });

  logger.info(`Student created: ${studentId} - ${email}`);

  const setupLink = `${process.env.CORS_ORIGIN}/setup-password?token=${setupToken}`;
  logger.info(`Setup link for ${email}: ${setupLink}`);

  let emailResult: { sent: boolean; reason?: string } = { sent: false, reason: 'Skipped' };
  if (sendInviteEmail !== false) {
    emailResult = await sendStudentInvitationEmail({
      to: user.email,
      studentName: user.name,
      studentId,
      setupLink,
      courseTitle,
    });
  }

  const { whatsappMessage, whatsappUrl } = buildWhatsAppInvite({
    phone: phone.trim(),
    studentName: user.name,
    studentId,
    email: user.email,
    setupLink,
    courseTitle,
  });

  res.status(201).json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      studentId: user.studentProfile?.studentId,
      setupLink,
      emailSent: emailResult.sent,
      whatsappMessage,
      whatsappUrl,
    },
    message: `Student account created with ID ${studentId}`,
  });
});

// PATCH /api/admin/students/:id/deactivate
router.patch('/:id/deactivate', async (req, res) => {
  const adminId = getCurrentUserId(req);

  const user = await prisma.user.findUnique({ where: { id: req.params.id, role: 'STUDENT' } });
  if (!user) throw new NotFoundError('Student');

  await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }),
    prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'STUDENT_DEACTIVATED',
        entityType: 'User',
        entityId: user.id,
        description: `Deactivated student: ${user.name}`,
      },
    }),
  ]);

  res.json({ success: true, message: 'Student account deactivated' });
});

// PATCH /api/admin/students/:id/reactivate
router.patch('/:id/reactivate', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id, role: 'STUDENT' } });
  if (!user) throw new NotFoundError('Student');

  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } });

  res.json({ success: true, message: 'Student account reactivated' });
});

// POST /api/admin/students/:id/reset-access - Regenerate setup link
router.post('/:id/reset-access', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id, role: 'STUDENT' },
    include: { studentProfile: true },
  });
  if (!user || !user.studentProfile) throw new NotFoundError('Student');

  const setupToken = randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Invalidate old tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: req.params.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: req.params.id,
      token: setupToken,
      expiresAt: tokenExpiry,
    },
  });

  const setupLink = `${process.env.CORS_ORIGIN}/setup-password?token=${setupToken}`;
  const emailResult = await sendStudentInvitationEmail({
    to: user.email,
    studentName: user.name,
    studentId: user.studentProfile.studentId,
    setupLink,
  });

  const { whatsappMessage, whatsappUrl } = buildWhatsAppInvite({
    phone: user.studentProfile.phone,
    studentName: user.name,
    studentId: user.studentProfile.studentId,
    email: user.email,
    setupLink,
  });

  res.json({
    success: true,
    data: {
      setupLink,
      emailSent: emailResult.sent,
      whatsappMessage,
      whatsappUrl,
    },
    message: 'New setup link generated',
  });
});

// POST /api/admin/students/:id/enroll - Assign an additional course to a student
router.post('/:id/enroll', async (req, res) => {
  const adminId = getCurrentUserId(req);
  const { courseId } = req.body as { courseId?: string };
  if (!courseId) throw new AppError('courseId is required', 400);

  const user = await prisma.user.findUnique({
    where: { id: req.params.id, role: 'STUDENT' },
    include: { studentProfile: true },
  });
  if (!user || !user.studentProfile) throw new NotFoundError('Student');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Course');

  const existing = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: user.studentProfile.id,
        courseId,
      },
    },
  });
  if (existing) throw new ConflictError('Student is already enrolled in this course');

  await prisma.$transaction([
    prisma.enrollment.create({
      data: {
        studentProfileId: user.studentProfile.id,
        courseId,
        status: 'ACTIVE',
      },
    }),
    prisma.course.update({
      where: { id: courseId },
      data: { enrollmentCount: { increment: 1 } },
    }),
    prisma.notification.create({
      data: {
        recipientId: user.id,
        type: 'ENROLLMENT_CREATED',
        title: `Enrolled in ${course.title}`,
        message: `You now have access to ${course.title}. Visit My Courses to start learning!`,
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'ENROLLMENT_CREATED',
        entityType: 'Enrollment',
        entityId: courseId,
        description: `Enrolled ${user.studentProfile.studentId} in ${course.title}`,
      },
    }),
  ]);

  res.status(201).json({ success: true, message: `Enrolled student in ${course.title}` });
});

export default router;
