import { Router } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError, AppError } from '../../middleware/errorHandler';
import { getCurrentUserId } from '../../middleware/auth';
import { logger } from '../../config/logger';
import { sendStudentInvitationEmail, sendPaymentRejectedEmail } from '../../services/email';
import { buildWhatsAppInvite } from '../../services/whatsapp';

const router = Router();

// GET /api/admin/payments - List all payment submissions
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const status = req.query.status as string | undefined;

  const where = status ? { status: status as never } : {};

  const [payments, total] = await Promise.all([
    prisma.paymentSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paymentSubmission.count({ where }),
  ]);

  res.json({
    success: true,
    data: payments,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/admin/payments/:id
router.get('/:id', async (req, res) => {
  const payment = await prisma.paymentSubmission.findUnique({
    where: { id: req.params.id },
    include: { courseRequest: true },
  });
  if (!payment) throw new NotFoundError('Payment');
  res.json({ success: true, data: payment });
});

// POST /api/admin/payments/:id/approve
// Creates student account + enrollment in a single transaction
router.post('/:id/approve', async (req, res) => {
  const adminId = getCurrentUserId(req);
  const { adminNotes } = req.body as { adminNotes?: string };

  const payment = await prisma.paymentSubmission.findUnique({
    where: { id: req.params.id },
  });
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status !== 'PENDING') {
    throw new AppError(`Payment is already ${payment.status.toLowerCase()}`, 400);
  }

  // Check for existing user
  const existingUser = await prisma.user.findUnique({
    where: { email: payment.studentEmail.toLowerCase() },
  });
  if (existingUser) {
    throw new AppError(
      'A student account already exists with this email. Use the Students panel to assign a course.',
      409,
    );
  }

  // Generate Student ID
  const year = new Date().getFullYear();
  const prefix = `AKL-${year}-`;
  const lastProfile = await prisma.studentProfile.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: 'desc' },
  });
  let nextNum = 1;
  if (lastProfile) {
    nextNum = parseInt(lastProfile.studentId.split('-')[2] || '0', 10) + 1;
  }
  const studentId = `${prefix}${String(nextNum).padStart(4, '0')}`;

  // Generate setup token
  const { randomBytes } = await import('crypto');
  const setupToken = randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update payment status
    const updatedPayment = await tx.paymentSubmission.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        verifiedById: adminId,
        verifiedAt: new Date(),
        adminNotes: adminNotes ?? null,
      },
    });

    // 2. Create user + student profile
    const user = await tx.user.create({
      data: {
        email: payment.studentEmail.toLowerCase(),
        name: payment.studentName,
        role: 'STUDENT',
        isActive: true,
        studentProfile: {
          create: {
            studentId,
            phone: payment.studentPhone,
          },
        },
        passwordResetTokens: {
          create: { token: setupToken, expiresAt: tokenExpiry },
        },
      },
      include: { studentProfile: true },
    });

    // 3. Create enrollment if courseId present
    if (payment.courseId && user.studentProfile) {
      await tx.enrollment.create({
        data: {
          studentProfileId: user.studentProfile.id,
          courseId: payment.courseId,
          status: 'ACTIVE',
        },
      });
      await tx.course.update({
        where: { id: payment.courseId },
        data: { enrollmentCount: { increment: 1 } },
      });
    }

    // 4. Mark course request as processed
    if (payment.courseRequestId) {
      await tx.courseRequest.update({
        where: { id: payment.courseRequestId },
        data: { isProcessed: true, processedAt: new Date() },
      });
    }

    // 5. Audit log
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: 'PAYMENT_APPROVED',
        entityType: 'PaymentSubmission',
        entityId: req.params.id,
        description: `Approved payment UTR ${payment.utrNumber} for ${payment.studentName} → StudentID: ${studentId}`,
      },
    });

    // 6. Create notification for student
    await tx.notification.create({
      data: {
        recipientId: user.id,
        type: 'PAYMENT_APPROVED',
        title: 'Payment Approved — Welcome to AK Learning!',
        message: `Your payment has been verified. Your Student ID is ${studentId}. Please set up your password using the link sent to ${payment.studentEmail}.`,
      },
    });

    return { payment: updatedPayment, user, studentId };
  });

  const setupLink = `${process.env.CORS_ORIGIN}/setup-password?token=${setupToken}`;
  logger.info(`Payment approved. Student created: ${studentId}. Setup: ${setupLink}`);

  const course = payment.courseId
    ? await prisma.course.findUnique({ where: { id: payment.courseId }, select: { title: true } })
    : null;

  const emailResult = await sendStudentInvitationEmail({
    to: payment.studentEmail,
    studentName: payment.studentName,
    studentId: result.studentId,
    setupLink,
    courseTitle: course?.title,
  });

  const { whatsappMessage, whatsappUrl } = buildWhatsAppInvite({
    phone: payment.studentPhone,
    studentName: payment.studentName,
    studentId: result.studentId,
    email: payment.studentEmail,
    setupLink,
    courseTitle: course?.title,
  });

  res.json({
    success: true,
    data: {
      studentId: result.studentId,
      studentEmail: payment.studentEmail,
      setupLink,
      emailSent: emailResult.sent,
      whatsappMessage,
      whatsappUrl,
    },
    message: `Payment approved. Student account created with ID ${result.studentId}.`,
  });
});

// POST /api/admin/payments/:id/reject
router.post('/:id/reject', async (req, res) => {
  const adminId = getCurrentUserId(req);
  const { rejectionReason, adminNotes } = req.body as {
    rejectionReason?: string;
    adminNotes?: string;
  };

  const payment = await prisma.paymentSubmission.findUnique({
    where: { id: req.params.id },
  });
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status !== 'PENDING') {
    throw new AppError(`Payment is already ${payment.status.toLowerCase()}`, 400);
  }

  await prisma.$transaction([
    prisma.paymentSubmission.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        verifiedById: adminId,
        verifiedAt: new Date(),
        rejectionReason: rejectionReason ?? null,
        adminNotes: adminNotes ?? null,
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'PAYMENT_REJECTED',
        entityType: 'PaymentSubmission',
        entityId: req.params.id,
        description: `Rejected payment UTR ${payment.utrNumber} from ${payment.studentName}. Reason: ${rejectionReason || 'Not specified'}`,
      },
    }),
  ]);

  await sendPaymentRejectedEmail({
    to: payment.studentEmail,
    studentName: payment.studentName,
    utrNumber: payment.utrNumber,
    reason: rejectionReason,
  });

  res.json({ success: true, message: 'Payment rejected.' });
});

export default router;
