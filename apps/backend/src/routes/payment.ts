import { Router } from 'express';
import { prisma } from '../config/database';
import { AppError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// POST /api/public/course-request - Student submits interest in a course
router.post('/course-request', async (req, res) => {
  const { courseId, studentName, studentEmail, studentPhone, message } = req.body as {
    courseId: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    message?: string;
  };

  if (!courseId || !studentName || !studentEmail || !studentPhone) {
    throw new AppError('Course ID, name, email, and phone are required', 400);
  }

  // Verify course exists and is published
  const course = await prisma.course.findUnique({
    where: { id: courseId, status: 'PUBLISHED' },
    select: { id: true, title: true, pricePaise: true },
  });
  if (!course) throw new AppError('Course not found or not available for enrollment', 404);

  // Check for existing active request
  const existingRequest = await prisma.courseRequest.findFirst({
    where: {
      courseId,
      studentEmail: studentEmail.toLowerCase().trim(),
      isProcessed: false,
    },
  });
  if (existingRequest) {
    throw new ConflictError(
      'A request for this course already exists with your email. Please submit your payment to continue.',
    );
  }

  // Check if already enrolled
  const existingUser = await prisma.user.findUnique({
    where: { email: studentEmail.toLowerCase().trim() },
    include: { studentProfile: { include: { enrollments: true } } },
  });
  if (existingUser?.studentProfile) {
    const enrolled = existingUser.studentProfile.enrollments.some((e) => e.courseId === courseId);
    if (enrolled) throw new ConflictError('You are already enrolled in this course.');
  }

  const request = await prisma.courseRequest.create({
    data: {
      courseId,
      studentName: studentName.trim(),
      studentEmail: studentEmail.toLowerCase().trim(),
      studentPhone: studentPhone.trim(),
      message: message?.trim() ?? null,
    },
    include: { course: { select: { title: true, pricePaise: true } } },
  });

  logger.info(`Course request: ${studentEmail} → ${course.title}`);

  res.status(201).json({
    success: true,
    data: {
      requestId: request.id,
      courseTitle: request.course.title,
      pricePaise: request.course.pricePaise,
    },
    message: 'Request received! Please complete your payment to get enrolled.',
  });
});

// POST /api/public/payment - Student submits UTR after paying
router.post('/payment', async (req, res) => {
  const {
    courseRequestId,
    courseId,
    studentName,
    studentEmail,
    studentPhone,
    utrNumber,
    paymentDate,
    amountPaise,
    paymentApp,
    screenshotUrl,
    notes,
  } = req.body as {
    courseRequestId?: string;
    courseId: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    utrNumber: string;
    paymentDate: string;
    amountPaise: number;
    paymentApp?: string;
    screenshotUrl?: string;
    notes?: string;
  };

  // Validate required fields
  if (!courseId || !studentName || !studentEmail || !utrNumber || !paymentDate || !amountPaise) {
    throw new AppError('All payment fields are required', 400);
  }

  if (!utrNumber.match(/^[A-Z0-9]{6,50}$/i)) {
    throw new AppError('Invalid UTR number format', 400);
  }

  // Check UTR not already submitted
  const existingUtr = await prisma.paymentSubmission.findFirst({
    where: { utrNumber: utrNumber.toUpperCase() },
  });
  if (existingUtr) {
    throw new ConflictError('This UTR number has already been submitted. Please contact support if this is a mistake.');
  }

  // Verify course
  const course = await prisma.course.findUnique({
    where: { id: courseId, status: 'PUBLISHED' },
    select: { id: true, title: true, pricePaise: true },
  });
  if (!course) throw new AppError('Course not found', 404);

  // Parse payment date
  let parsedDate: Date;
  try {
    parsedDate = new Date(paymentDate);
    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date');
  } catch {
    throw new AppError('Invalid payment date format', 400);
  }

  // Create payment submission
  const payment = await prisma.paymentSubmission.create({
    data: {
      courseRequestId: courseRequestId ?? null,
      courseId,
      studentName: studentName.trim(),
      studentEmail: studentEmail.toLowerCase().trim(),
      studentPhone: studentPhone.trim(),
      utrNumber: utrNumber.toUpperCase().trim(),
      paymentDate: parsedDate,
      amountPaise,
      paymentApp: paymentApp as never ?? null,
      screenshotUrl: screenshotUrl ?? null,
      status: 'PENDING',
    },
  });

  logger.info(`Payment submitted: UTR ${utrNumber} from ${studentEmail} for course ${courseId}`);

  // Create notification for all admins
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        recipientId: admin.id,
        type: 'PAYMENT_RECEIVED' as const,
        title: `New Payment: ${studentName}`,
        message: `UTR: ${utrNumber} | Amount: ₹${(amountPaise / 100).toLocaleString('en-IN')} | Course: ${course.title}`,
      })),
    });
  }

  res.status(201).json({
    success: true,
    data: {
      paymentId: payment.id,
      status: payment.status,
      utrNumber: payment.utrNumber,
    },
    message: 'Payment submitted successfully! Admin will verify within 24 hours.',
  });
});

// GET /api/public/payment/status/:utr - Check payment status by UTR
router.get('/payment/status/:utr', async (req, res) => {
  const utr = req.params.utr.toUpperCase().trim();

  const payment = await prisma.paymentSubmission.findFirst({
    where: { utrNumber: utr },
    select: {
      id: true,
      status: true,
      utrNumber: true,
      studentEmail: true,
      studentName: true,
      courseId: true,
      createdAt: true,
      verifiedAt: true,
      rejectionReason: true,
    },
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'No payment found with this UTR number.',
    });
  }

  return res.json({ success: true, data: payment });
});

// GET /api/public/courses (already in public.ts — keep existing)
// GET /api/public/categories (already in public.ts)
// GET /api/public/upi (already in public.ts)

export default router;
