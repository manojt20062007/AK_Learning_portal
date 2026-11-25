import { Router } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../middleware/errorHandler';
import { LiveSessionStatus } from '@prisma/client';

const router = Router();

function makeRoomName(courseSlug: string): string {
  const safeSlug = courseSlug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'course';
  const suffix = randomBytes(4).toString('hex');
  return `AKLearning-${safeSlug}-${suffix}`;
}

// GET /api/admin/live
router.get('/', async (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const status = req.query.status as LiveSessionStatus | undefined;

  const sessions = await prisma.liveSession.findMany({
    where: {
      ...(courseId && { courseId }),
      ...(status && { status }),
    },
    include: {
      course: { select: { id: true, title: true, slug: true } },
    },
    orderBy: [{ scheduledAt: 'desc' }],
  });

  res.json({ success: true, data: sessions });
});

// POST /api/admin/live - Schedule a Jitsi or Whereby live session for a course
router.post('/', async (req, res) => {
  const { courseId, title, description, scheduledAt, durationMinutes, provider, externalRoomUrl } = req.body as {
    courseId?: string;
    title?: string;
    description?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    provider?: 'JITSI' | 'WHEREBY';
    externalRoomUrl?: string;
  };

  if (!courseId || !title || title.trim().length < 2 || !scheduledAt) {
    throw new AppError('courseId, title, and scheduledAt are required', 400);
  }

  const chosenProvider = provider === 'WHEREBY' ? 'WHEREBY' : 'JITSI';
  if (chosenProvider === 'WHEREBY') {
    if (!externalRoomUrl || !/^https:\/\/([a-z0-9-]+\.)?whereby\.com\/.+/i.test(externalRoomUrl.trim())) {
      throw new AppError('Enter a valid Whereby room URL (e.g. https://whereby.com/your-room)', 400);
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, slug: true },
  });
  if (!course) throw new NotFoundError('Course');

  const parsedDate = new Date(scheduledAt);
  if (isNaN(parsedDate.getTime())) {
    throw new AppError('Invalid scheduledAt date/time', 400);
  }

  const roomName = makeRoomName(course.slug);

  const session = await prisma.liveSession.create({
    data: {
      courseId,
      title: title.trim(),
      description: description?.trim() ?? null,
      provider: chosenProvider,
      roomName,
      externalRoomUrl: chosenProvider === 'WHEREBY' ? externalRoomUrl!.trim() : null,
      scheduledAt: parsedDate,
      durationMinutes: durationMinutes ? Math.max(10, Math.min(480, Number(durationMinutes))) : 60,
      status: 'SCHEDULED',
    },
    include: {
      course: { select: { id: true, title: true, slug: true } },
    },
  });

  res.status(201).json({ success: true, data: session, message: 'Live session scheduled' });
});

// PATCH /api/admin/live/:id/status - Go LIVE or END session
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body as { status?: LiveSessionStatus };
  if (!status || !['SCHEDULED', 'LIVE', 'ENDED'].includes(status)) {
    throw new AppError('Invalid status. Use SCHEDULED, LIVE, or ENDED', 400);
  }

  const existing = await prisma.liveSession.findUnique({
    where: { id: req.params.id },
    include: { course: { select: { id: true, title: true } } },
  });
  if (!existing) throw new NotFoundError('Live session');

  const updated = await prisma.liveSession.update({
    where: { id: existing.id },
    data: { status },
    include: { course: { select: { id: true, title: true, slug: true } } },
  });

  // Notify enrolled students when class goes LIVE
  if (status === 'LIVE') {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: existing.courseId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      select: { studentProfile: { select: { userId: true } } },
    });

    if (enrollments.length > 0) {
      await prisma.notification.createMany({
        data: enrollments.map((e) => ({
          recipientId: e.studentProfile.userId,
          type: 'SYSTEM_ALERT' as const,
          title: `Live Class Started: ${existing.title}`,
          message: `Your live session for "${existing.course.title}" is now live. Open your dashboard to join.`,
        })),
      });
    }
  }

  res.json({ success: true, data: updated, message: `Session marked as ${status}` });
});

// PATCH /api/admin/live/:id - Update details or attach recordingUrl
router.patch('/:id', async (req, res) => {
  const existing = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Live session');

  const { title, description, scheduledAt, durationMinutes, recordingUrl } = req.body as {
    title?: string;
    description?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    recordingUrl?: string | null;
  };

  const updated = await prisma.liveSession.update({
    where: { id: existing.id },
    data: {
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() ?? null }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(durationMinutes !== undefined && { durationMinutes: Number(durationMinutes) }),
      ...(recordingUrl !== undefined && { recordingUrl: recordingUrl?.trim() || null }),
    },
    include: { course: { select: { id: true, title: true, slug: true } } },
  });

  res.json({ success: true, data: updated });
});

// DELETE /api/admin/live/:id
router.delete('/:id', async (req, res) => {
  const existing = await prisma.liveSession.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Live session');

  await prisma.liveSession.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Live session deleted' });
});

export default router;
