import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth, requireStudent, getCurrentUserId } from '../middleware/auth';
import { AppError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { isJaasConfigured, signJaasJwt } from '../services/jaas';

const router = Router();

// GET /api/live/my-sessions - Student's scheduled & live sessions across enrolled courses
router.get('/my-sessions', requireStudent, async (req, res) => {
  const userId = getCurrentUserId(req);
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      enrollments: {
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { courseId: true },
      },
    },
  });

  if (!profile) {
    return res.json({ success: true, data: [] });
  }

  const courseIds = profile.enrollments.map((e) => e.courseId);
  if (courseIds.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const sessions = await prisma.liveSession.findMany({
    where: {
      courseId: { in: courseIds },
      OR: [
        { status: { in: ['LIVE', 'SCHEDULED'] } },
        { status: 'ENDED', recordingUrl: { not: null } },
      ],
    },
    include: {
      course: { select: { id: true, title: true, slug: true } },
    },
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
  });

  return res.json({ success: true, data: sessions });
});

// GET /api/live/:sessionId/join - Authorized room details for Jitsi IFrame
router.get('/:sessionId/join', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  const sessionId = String(req.params.sessionId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: { select: { id: true, studentId: true } },
    },
  });
  if (!user) throw new NotFoundError('User');

  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      course: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!session) throw new NotFoundError('Live session');

  const isHost = user.role === 'ADMIN';

  if (!isHost) {
    if (!user.studentProfile) {
      throw new ForbiddenError('Student profile required to join live session');
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentProfileId_courseId: {
          studentProfileId: user.studentProfile.id,
          courseId: session.courseId,
        },
      },
    });
    if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
      throw new ForbiddenError('Active enrollment in this course is required to join');
    }
    if (session.status === 'ENDED') {
      throw new AppError('This live session has ended', 400);
    }
  }

  const displayName = isHost
    ? `${user.name} (Host)`
    : `${user.name} (${user.studentProfile?.studentId ?? 'Student'})`;

  let jitsiDomain = 'meet.jit.si';
  let roomName = session.roomName;
  let jwt: string | undefined;

  if (session.provider === 'JITSI' && isJaasConfigured()) {
    const signed = signJaasJwt({
      userId: user.id,
      displayName,
      email: user.email,
      roomName: session.roomName,
      isModerator: isHost,
    });
    jitsiDomain = '8x8.vc';
    roomName = signed.roomPath;
    jwt = signed.jwt;
  }

  res.json({
    success: true,
    data: {
      id: session.id,
      title: session.title,
      description: session.description,
      courseId: session.course.id,
      courseTitle: session.course.title,
      provider: session.provider,
      roomName,
      externalRoomUrl: session.externalRoomUrl,
      jitsiDomain,
      jwt,
      displayName,
      email: user.email,
      isHost,
      status: session.status,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
    },
  });
});

export default router;
