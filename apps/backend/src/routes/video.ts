import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth, getCurrentUserId } from '../middleware/auth';
import { AppError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { getR2ObjectText, getSignedR2Url } from '../services/r2';

const router = Router();

async function authorizeLessonPlayback(userId: string, lessonId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      studentProfile: { select: { id: true, studentId: true } },
    },
  });
  if (!user) throw new NotFoundError('User');

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      videoAsset: true,
      section: { select: { courseId: true } },
    },
  });
  if (!lesson) throw new NotFoundError('Lesson');

  if (!lesson.videoAsset || lesson.videoAsset.status !== 'READY' || !lesson.videoAsset.hlsManifestKey) {
    throw new AppError('Video is not ready for playback yet', 404, 'VIDEO_NOT_READY');
  }

  let enrollmentId: string | null = null;

  if (user.role !== 'ADMIN') {
    if (!user.studentProfile) {
      throw new ForbiddenError('Student profile required for playback');
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentProfileId_courseId: {
          studentProfileId: user.studentProfile.id,
          courseId: lesson.section.courseId,
        },
      },
    });

    if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
      if (!lesson.isFreePreview) {
        throw new ForbiddenError('Active course enrollment is required to watch this lesson');
      }
    } else {
      enrollmentId = enrollment.id;
    }
  }

  return { user, lesson, enrollmentId };
}

// POST /api/video/lessons/:lessonId/session
// Verifies auth + enrollment, creates PlaybackSession, returns playlist endpoint + watermark info
router.post('/lessons/:lessonId/session', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  const lessonId = String(req.params.lessonId);
  const { user, lesson } = await authorizeLessonPlayback(userId, lessonId);

  let playbackSessionId: string | null = null;
  if (user.studentProfile) {
    const session = await prisma.playbackSession.create({
      data: {
        studentProfileId: user.studentProfile.id,
        lessonId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      },
    });
    playbackSessionId = session.id;
  }

  res.json({
    success: true,
    data: {
      playbackSessionId,
      playlistUrl: `/api/video/lessons/${lessonId}/playlist.m3u8`,
      durationSeconds: lesson.videoAsset!.durationSeconds ?? lesson.durationSeconds ?? 0,
      watermark: {
        studentId: user.studentProfile?.studentId ?? 'ADMIN-PREVIEW',
        studentName: user.name,
      },
    },
  });
});

// GET /api/video/lessons/:lessonId/playlist.m3u8
// Rewrites private R2 segment keys into short-lived (15 min) presigned R2 URLs
router.get('/lessons/:lessonId/playlist.m3u8', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  const lessonId = String(req.params.lessonId);
  const { lesson } = await authorizeLessonPlayback(userId, lessonId);

  const manifestKey = lesson.videoAsset!.hlsManifestKey!;
  const keyPrefix = manifestKey.substring(0, manifestKey.lastIndexOf('/') + 1);
  const rawManifest = await getR2ObjectText(manifestKey);

  const lines = rawManifest.split(/\r?\n/);
  const rewritten = await Promise.all(
    lines.map(async (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }
      const segmentKey = `${keyPrefix}${trimmed}`;
      return getSignedR2Url(segmentKey, 900); // 15 minutes
    }),
  );

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.send(rewritten.join('\n'));
});

// PATCH /api/video/sessions/:sessionId/heartbeat
// Tracks watchedSeconds and updates LessonProgress.lastPosition
router.patch('/sessions/:sessionId/heartbeat', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  const sessionId = String(req.params.sessionId);
  const { currentTimeSeconds, watchedDeltaSeconds } = req.body as {
    currentTimeSeconds?: number;
    watchedDeltaSeconds?: number;
  };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });
  if (!user?.studentProfile) {
    return res.json({ success: true });
  }

  const session = await prisma.playbackSession.findFirst({
    where: { id: sessionId, studentProfileId: user.studentProfile.id },
    include: { lesson: { include: { section: true } } },
  });
  if (!session) throw new NotFoundError('Playback session');

  const delta = Math.max(0, Math.min(60, Math.round(watchedDeltaSeconds ?? 0)));
  const position = Math.max(0, Math.round(currentTimeSeconds ?? 0));

  await prisma.playbackSession.update({
    where: { id: session.id },
    data: {
      watchedSeconds: { increment: delta },
      endedAt: new Date(),
    },
  });

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentProfileId_courseId: {
        studentProfileId: user.studentProfile.id,
        courseId: session.lesson.section.courseId,
      },
    },
  });

  if (enrollment) {
    await prisma.lessonProgress.upsert({
      where: {
        studentProfileId_lessonId: {
          studentProfileId: user.studentProfile.id,
          lessonId: session.lessonId,
        },
      },
      create: {
        studentProfileId: user.studentProfile.id,
        lessonId: session.lessonId,
        enrollmentId: enrollment.id,
        lastPosition: position,
        watchedSeconds: delta,
      },
      update: {
        lastPosition: position,
        watchedSeconds: { increment: delta },
      },
    });
  }

  return res.json({ success: true });
});

export default router;
