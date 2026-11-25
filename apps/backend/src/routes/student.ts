import { Router } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../config/database';
import { requireStudent, getCurrentUserId } from '../middleware/auth';
import { NotFoundError, AppError, ForbiddenError } from '../middleware/errorHandler';
import { getSignedR2Url } from '../services/r2';

const router = Router();

// All student routes require STUDENT role
router.use(requireStudent);

async function getStudentProfileOrThrow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      studentProfile: true,
    },
  });
  if (!user || !user.studentProfile) {
    throw new NotFoundError('Student profile');
  }
  return user;
}

// GET /api/student/dashboard - Overview, enrolled courses, unread notifications
router.get('/dashboard', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;

  const [enrollments, unreadNotifications, certificatesCount] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentProfileId: profileId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            shortDescription: true,
            thumbnailUrl: true,
            level: true,
            durationHours: true,
            totalLessons: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    }),
    prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    }),
    prisma.certificate.count({
      where: { studentProfileId: profileId },
    }),
  ]);

  res.json({
    success: true,
    data: {
      student: {
        id: user.id,
        name: user.name,
        email: user.email,
        studentId: user.studentProfile!.studentId,
        phone: user.studentProfile!.phone,
        memberSince: user.createdAt,
      },
      stats: {
        enrolledCourses: enrollments.length,
        completedCourses: enrollments.filter((e) => e.status === 'COMPLETED').length,
        certificates: certificatesCount,
        unreadNotifications,
      },
      enrollments,
    },
  });
});

// GET /api/student/courses - Enrolled courses list
router.get('/courses', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);

  const enrollments = await prisma.enrollment.findMany({
    where: { studentProfileId: user.studentProfile!.id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          level: true,
          durationHours: true,
          totalLessons: true,
          category: { select: { name: true, color: true } },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  res.json({ success: true, data: enrollments });
});

// GET /api/student/profile
router.get('/profile', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);

  res.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      studentId: user.studentProfile!.studentId,
      phone: user.studentProfile!.phone,
      bio: user.studentProfile!.bio,
      profilePhoto: user.studentProfile!.profilePhoto,
      createdAt: user.createdAt,
    },
  });
});

// PATCH /api/student/profile
router.patch('/profile', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const { name, phone, bio } = req.body as { name?: string; phone?: string; bio?: string };

  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    throw new AppError('Enter a valid 10-digit Indian mobile number', 400);
  }

  await prisma.$transaction([
    ...(name && name.trim().length >= 2
      ? [prisma.user.update({ where: { id: userId }, data: { name: name.trim() } })]
      : []),
    prisma.studentProfile.update({
      where: { id: user.studentProfile!.id },
      data: {
        ...(phone && { phone }),
        ...(bio !== undefined && { bio: bio?.trim() ?? null }),
      },
    }),
  ]);

  res.json({ success: true, message: 'Profile updated successfully' });
});

// GET /api/student/payments - Payment history for this student
router.get('/payments', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);

  const payments = await prisma.paymentSubmission.findMany({
    where: { studentEmail: user.email.toLowerCase() },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: payments });
});

// GET /api/student/notifications
router.get('/notifications', async (req, res) => {
  const userId = getCurrentUserId(req);

  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ success: true, data: notifications });
});

// PATCH /api/student/notifications/:id/read
router.patch('/notifications/:id/read', async (req, res) => {
  const userId = getCurrentUserId(req);

  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, recipientId: userId },
  });
  if (!notification) throw new NotFoundError('Notification');

  await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  });

  res.json({ success: true, message: 'Notification marked as read' });
});

// GET /api/student/courses/:courseId/learn - Full learning view with progress & resources
router.get('/courses/:courseId/learn', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;
  const courseId = String(req.params.courseId);

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId,
      },
    },
  });

  if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
    throw new ForbiddenError('Active enrollment required to access this course');
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      sections: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              order: true,
              durationSeconds: true,
              isFreePreview: true,
              videoAsset: { select: { status: true, durationSeconds: true } },
              resources: {
                select: { id: true, title: true, type: true, url: true, fileSize: true },
              },
              quiz: { select: { id: true, title: true, isPublished: true } },
            },
          },
        },
      },
    },
  });

  if (!course) throw new NotFoundError('Course');

  const progressRows = await prisma.lessonProgress.findMany({
    where: { studentProfileId: profileId, enrollmentId: enrollment.id },
  });
  const progressMap = new Map(progressRows.map((p) => [p.lessonId, p]));

  const sections = course.sections.map((sec) => ({
    ...sec,
    lessons: sec.lessons.map((l) => {
      const prog = progressMap.get(l.id);
      return {
        ...l,
        resources: l.resources.map((r) => ({
          ...r,
          fileSize: r.fileSize ? Number(r.fileSize) : null,
        })),
        progress: {
          isCompleted: prog?.isCompleted ?? false,
          lastPosition: prog?.lastPosition ?? 0,
          watchedSeconds: prog?.watchedSeconds ?? 0,
        },
      };
    }),
  }));

  res.json({
    success: true,
    data: {
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        progressPercent: enrollment.progressPercent,
        completedAt: enrollment.completedAt,
      },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        shortDescription: course.shortDescription,
        sections,
      },
    },
  });
});

// POST /api/student/lessons/:lessonId/complete - Mark lesson complete/incomplete and recalculate course progress
router.post('/lessons/:lessonId/complete', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;
  const lessonId = String(req.params.lessonId);
  const completed = (req.body as { completed?: boolean })?.completed ?? true;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { select: { courseId: true } } },
  });
  if (!lesson) throw new NotFoundError('Lesson');

  const courseId = lesson.section.courseId;
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId,
      },
    },
  });
  if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
    throw new ForbiddenError('Active enrollment required');
  }

  await prisma.lessonProgress.upsert({
    where: {
      studentProfileId_lessonId: {
        studentProfileId: profileId,
        lessonId,
      },
    },
    create: {
      studentProfileId: profileId,
      lessonId,
      enrollmentId: enrollment.id,
      isCompleted: completed,
      completedAt: completed ? new Date() : null,
    },
    update: {
      isCompleted: completed,
      completedAt: completed ? new Date() : null,
    },
  });

  // Recalculate course progress
  const totalLessons = await prisma.lesson.count({
    where: { section: { courseId } },
  });
  const completedLessons = await prisma.lessonProgress.count({
    where: { enrollmentId: enrollment.id, isCompleted: true },
  });

  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isCourseDone = totalLessons > 0 && completedLessons >= totalLessons;

  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progressPercent,
      status: isCourseDone ? 'COMPLETED' : 'ACTIVE',
      completedAt: isCourseDone ? enrollment.completedAt ?? new Date() : null,
    },
  });

  res.json({
    success: true,
    data: {
      lessonId,
      isCompleted: completed,
      progressPercent: updatedEnrollment.progressPercent,
      courseStatus: updatedEnrollment.status,
      completedLessons,
      totalLessons,
    },
  });
});

// GET /api/student/resources/:resourceId/download - Authorized resource download
router.get('/resources/:resourceId/download', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;

  const resource = await prisma.lessonResource.findUnique({
    where: { id: String(req.params.resourceId) },
    include: {
      lesson: { include: { section: { select: { courseId: true } } } },
    },
  });
  if (!resource) throw new NotFoundError('Resource');

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId: resource.lesson.section.courseId,
      },
    },
  });
  if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
    throw new ForbiddenError('Active enrollment required to download this resource');
  }

  let downloadUrl = resource.url;
  if (resource.r2Key) {
    downloadUrl = await getSignedR2Url(resource.r2Key, 900);
  }
  if (!downloadUrl) {
    throw new AppError('Resource file URL is not available', 404);
  }

  res.json({
    success: true,
    data: {
      id: resource.id,
      title: resource.title,
      type: resource.type,
      downloadUrl,
    },
  });
});

// GET /api/student/quizzes/:quizId - Quiz details & past attempts (without correct answers)
router.get('/quizzes/:quizId', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;

  const quiz = await prisma.quiz.findUnique({
    where: { id: String(req.params.quizId) },
    include: {
      lesson: { include: { section: { select: { courseId: true } } } },
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          text: true,
          order: true,
          points: true,
          options: {
            orderBy: { order: 'asc' },
            select: { id: true, text: true, order: true },
          },
        },
      },
    },
  });
  if (!quiz || !quiz.isPublished) throw new NotFoundError('Quiz');

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId: quiz.lesson.section.courseId,
      },
    },
  });
  if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
    throw new ForbiddenError('Active enrollment required to take this quiz');
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id, studentProfileId: profileId },
    orderBy: { startedAt: 'desc' },
  });

  res.json({
    success: true,
    data: {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimit,
        maxAttempts: quiz.maxAttempts,
        questions: quiz.questions,
      },
      attempts,
    },
  });
});

// POST /api/student/quizzes/:quizId/attempt - Submit and score quiz attempt
router.post('/quizzes/:quizId/attempt', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;
  const answers = ((req.body as { answers?: Record<string, string> })?.answers ?? {}) as Record<string, string>;

  const quiz = await prisma.quiz.findUnique({
    where: { id: String(req.params.quizId) },
    include: {
      lesson: { include: { section: { select: { courseId: true } } } },
      questions: {
        include: { options: true },
      },
    },
  });
  if (!quiz || !quiz.isPublished) throw new NotFoundError('Quiz');

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId: quiz.lesson.section.courseId,
      },
    },
  });
  if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
    throw new ForbiddenError('Active enrollment required');
  }

  const priorAttempts = await prisma.quizAttempt.count({
    where: { quizId: quiz.id, studentProfileId: profileId },
  });
  if (priorAttempts >= quiz.maxAttempts) {
    throw new AppError(`Maximum attempts (${quiz.maxAttempts}) reached for this quiz`, 400);
  }

  let score = 0;
  let maxScore = 0;
  for (const q of quiz.questions) {
    maxScore += q.points;
    const selectedOptId = answers[q.id];
    const correctOpt = q.options.find((o) => o.isCorrect);
    if (correctOpt && selectedOptId === correctOpt.id) {
      score += q.points;
    }
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percentage >= quiz.passingScore;

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      studentProfileId: profileId,
      score,
      maxScore,
      percentage,
      passed,
      answers,
      completedAt: new Date(),
    },
  });

  if (passed) {
    await prisma.notification.create({
      data: {
        recipientId: userId,
        type: 'QUIZ_PASSED',
        title: `Quiz Passed: ${quiz.title}`,
        message: `You scored ${percentage}% (${score}/${maxScore}) on ${quiz.title}.`,
      },
    });
  }

  res.status(201).json({
    success: true,
    data: attempt,
    message: passed ? `Congratulations! You passed with ${percentage}%` : `You scored ${percentage}% (passing: ${quiz.passingScore}%)`,
  });
});

// GET /api/student/certificates - Student's earned certificates
router.get('/certificates', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);

  const certificates = await prisma.certificate.findMany({
    where: { studentProfileId: user.studentProfile!.id },
    include: {
      course: { select: { id: true, title: true, slug: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  res.json({ success: true, data: certificates });
});

// POST /api/student/courses/:courseId/certificate - Claim certificate on course completion
router.post('/courses/:courseId/certificate', async (req, res) => {
  const userId = getCurrentUserId(req);
  const user = await getStudentProfileOrThrow(userId);
  const profileId = user.studentProfile!.id;
  const courseId = String(req.params.courseId);

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId,
      },
    },
    include: { course: { select: { title: true } } },
  });
  if (!enrollment) throw new ForbiddenError('Enrollment required');
  if (enrollment.status !== 'COMPLETED' && enrollment.progressPercent < 100) {
    throw new AppError('Complete all lessons in this course before claiming your certificate', 400);
  }

  const existing = await prisma.certificate.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: profileId,
        courseId,
      },
    },
  });
  if (existing) {
    return res.json({ success: true, data: existing, message: 'Certificate already issued' });
  }

  const year = new Date().getFullYear();
  const count = await prisma.certificate.count();
  const certificateNumber = `CERT-${year}-${String(count + 1).padStart(5, '0')}`;
  const verificationCode = randomBytes(6).toString('hex').toUpperCase();

  const cert = await prisma.certificate.create({
    data: {
      studentProfileId: profileId,
      courseId,
      certificateNumber,
      verificationCode,
    },
  });

  await prisma.notification.create({
    data: {
      recipientId: userId,
      type: 'CERTIFICATE_ISSUED',
      title: `Certificate Issued — ${enrollment.course.title}`,
      message: `Certificate ${certificateNumber} is ready. Verification code: ${verificationCode}`,
    },
  });

  return res.status(201).json({ success: true, data: cert, message: 'Certificate issued!' });
});

export default router;
