import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../config/database';
import { getCurrentUserId } from '../../middleware/auth';
import { AppError, NotFoundError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';
import {
  isR2Configured,
  R2_FREE_STORAGE_BYTES,
  uploadDirectoryToR2,
  deleteR2Prefix,
} from '../../services/r2';
import { checkFfmpegAvailable, probeVideo, transcodeToHls } from '../../services/ffmpeg';
import {
  isVdoCipherConfigured,
  uploadVideoToVdoCipher,
  getVdoCipherVideoInfo,
} from '../../services/vdocipher';

const router = Router();

const TEMP_UPLOAD_DIR = path.resolve(process.cwd(), 'temp', 'uploads');
const TEMP_HLS_DIR = path.resolve(process.cwd(), 'temp', 'hls');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `lesson-${req.params.lessonId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max per MP4
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'video/mp4' || file.originalname.toLowerCase().endsWith('.mp4')) {
      cb(null, true);
    } else {
      cb(new AppError('Only MP4 video files are supported', 400));
    }
  },
});

// GET /api/admin/videos/system-check
router.get('/system-check', async (_req, res) => {
  const ffmpegStatus = await checkFfmpegAvailable();
  res.json({
    success: true,
    data: {
      ...ffmpegStatus,
      r2Configured: isR2Configured(),
      vdoCipherConfigured: isVdoCipherConfigured(),
      freeAllowanceGb: 10,
    },
  });
});

// GET /api/admin/videos/storage - R2 storage usage monitoring
router.get('/storage', async (_req, res) => {
  const assets = await prisma.videoAsset.findMany({
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          section: {
            select: {
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const usedBytesBigInt = assets.reduce((sum, a) => sum + (a.fileSizeBytes ?? BigInt(0)), BigInt(0));
  const usedBytes = Number(usedBytesBigInt);
  const usedGb = +(usedBytes / (1024 * 1024 * 1024)).toFixed(3);
  const freeAllowanceGb = 10;
  const percentUsed = +((usedBytes / R2_FREE_STORAGE_BYTES) * 100).toFixed(2);
  const totalSeconds = assets.reduce((sum, a) => sum + (a.durationSeconds ?? 0), 0);

  res.json({
    success: true,
    data: {
      usedBytes,
      usedGb,
      freeAllowanceGb,
      percentUsed,
      exceedsFreeTier: usedBytes > R2_FREE_STORAGE_BYTES,
      totalHours: +(totalSeconds / 3600).toFixed(2),
      videoCount: assets.length,
      readyCount: assets.filter((a) => a.status === 'READY').length,
      assets: assets.map((a) => ({
        id: a.id,
        lessonId: a.lessonId,
        lessonTitle: a.lesson.title,
        courseTitle: a.lesson.section.course.title,
        provider: a.provider,
        vdoCipherVideoId: a.vdoCipherVideoId,
        status: a.status,
        resolution: a.resolution,
        durationSeconds: a.durationSeconds,
        fileSizeBytes: a.fileSizeBytes ? Number(a.fileSizeBytes) : 0,
        errorMessage: a.errorMessage,
        processedAt: a.processedAt,
      })),
    },
  });
});

// GET /api/admin/videos/lessons/:lessonId/status
router.get('/lessons/:lessonId/status', async (req, res) => {
  let asset = await prisma.videoAsset.findUnique({
    where: { lessonId: req.params.lessonId },
  });
  if (!asset) throw new NotFoundError('Video asset');

  // Sync VdoCipher processing status on-demand
  if (
    asset.provider === 'VIDEOCIPHER' &&
    asset.status === 'PROCESSING' &&
    asset.vdoCipherVideoId &&
    isVdoCipherConfigured()
  ) {
    try {
      const info = await getVdoCipherVideoInfo(asset.vdoCipherVideoId);
      if (info.status.toLowerCase() === 'ready') {
        asset = await prisma.videoAsset.update({
          where: { id: asset.id },
          data: {
            status: 'READY',
            durationSeconds: info.lengthSeconds || asset.durationSeconds,
            processedAt: new Date(),
          },
        });
        if (info.lengthSeconds > 0) {
          await prisma.lesson.update({
            where: { id: asset.lessonId },
            data: { durationSeconds: info.lengthSeconds },
          });
        }
      }
    } catch {
      // Ignore transient status sync errors
    }
  }

  res.json({
    success: true,
    data: {
      ...asset,
      fileSizeBytes: asset.fileSizeBytes ? Number(asset.fileSizeBytes) : 0,
    },
  });
});

// POST /api/admin/videos/lessons/:lessonId/upload-vdocipher
router.post('/lessons/:lessonId/upload-vdocipher', upload.single('video'), async (req, res) => {
  const adminId = getCurrentUserId(req);
  const lessonId = String(req.params.lessonId);

  if (!req.file) {
    throw new AppError('No MP4 video file uploaded (field name: video)', 400);
  }
  const uploadedPath = req.file.path;
  const fileSize = req.file.size;

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    await fs.promises.unlink(uploadedPath).catch(() => {});
    throw new NotFoundError('Lesson');
  }

  if (!isVdoCipherConfigured()) {
    await fs.promises.unlink(uploadedPath).catch(() => {});
    throw new AppError(
      'VdoCipher is not configured. Add VIDEOCIPHER_API_SECRET to apps/backend/.env.',
      503,
      'VDOCIPHER_NOT_CONFIGURED',
    );
  }

  try {
    const { videoId } = await uploadVideoToVdoCipher(uploadedPath, lesson.title);

    await prisma.$transaction([
      prisma.videoAsset.upsert({
        where: { lessonId },
        create: {
          lessonId,
          provider: 'VIDEOCIPHER',
          vdoCipherVideoId: videoId,
          fileSizeBytes: BigInt(fileSize),
          status: 'PROCESSING',
          errorMessage: null,
        },
        update: {
          provider: 'VIDEOCIPHER',
          vdoCipherVideoId: videoId,
          fileSizeBytes: BigInt(fileSize),
          status: 'PROCESSING',
          errorMessage: null,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'VIDEO_UPLOADED',
          entityType: 'Lesson',
          entityId: lessonId,
          description: `Uploaded lesson "${lesson.title}" to VdoCipher (ID: ${videoId})`,
        },
      }),
    ]);

    res.status(202).json({
      success: true,
      data: { lessonId, provider: 'VIDEOCIPHER', vdoCipherVideoId: videoId, status: 'PROCESSING' },
      message: 'Uploaded to VdoCipher. DRM transcoding is in progress.',
    });
  } finally {
    await fs.promises.unlink(uploadedPath).catch(() => {});
  }
});

// POST /api/admin/videos/lessons/:lessonId/upload
router.post('/lessons/:lessonId/upload', upload.single('video'), async (req, res) => {
  const adminId = getCurrentUserId(req);
  const lessonId = String(req.params.lessonId);

  if (!req.file) {
    throw new AppError('No MP4 video file uploaded (field name: video)', 400);
  }

  const uploadedPath = req.file.path;

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    await fs.promises.unlink(uploadedPath).catch(() => {});
    throw new NotFoundError('Lesson');
  }

  const ffmpegStatus = await checkFfmpegAvailable();
  if (!ffmpegStatus.ffmpeg || !ffmpegStatus.ffprobe) {
    await fs.promises.unlink(uploadedPath).catch(() => {});
    throw new AppError(
      'FFmpeg / ffprobe is not installed on the server. Install FFmpeg and add it to PATH before uploading videos.',
      503,
      'FFMPEG_NOT_AVAILABLE',
    );
  }

  if (!isR2Configured()) {
    await fs.promises.unlink(uploadedPath).catch(() => {});
    throw new AppError(
      'Cloudflare R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to apps/backend/.env.',
      503,
      'R2_NOT_CONFIGURED',
    );
  }

  await prisma.videoAsset.upsert({
    where: { lessonId },
    create: { lessonId, status: 'PROCESSING', errorMessage: null },
    update: { status: 'PROCESSING', errorMessage: null },
  });

  // Process transcoding + private R2 upload in the background
  const outputDir = path.join(TEMP_HLS_DIR, lessonId);
  const keyPrefix = `videos/${lessonId}`;

  (async () => {
    try {
      const probe = await probeVideo(uploadedPath);
      await transcodeToHls(uploadedPath, outputDir);

      // Remove previous R2 objects for this lesson if replacing
      await deleteR2Prefix(`${keyPrefix}/`);
      const { totalBytes } = await uploadDirectoryToR2(outputDir, keyPrefix);
      const manifestKey = `${keyPrefix}/master.m3u8`;

      await prisma.$transaction([
        prisma.videoAsset.update({
          where: { lessonId },
          data: {
            hlsManifestKey: manifestKey,
            status: 'READY',
            durationSeconds: probe.durationSeconds,
            fileSizeBytes: BigInt(totalBytes),
            resolution: probe.resolution,
            bitrateBps: probe.bitrateBps,
            processedAt: new Date(),
            errorMessage: null,
          },
        }),
        prisma.lesson.update({
          where: { id: lessonId },
          data: { durationSeconds: probe.durationSeconds },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminId,
            action: 'VIDEO_UPLOADED',
            entityType: 'Lesson',
            entityId: lessonId,
            description: `Transcoded & uploaded HLS video for lesson "${lesson.title}" (${totalBytes} bytes)`,
          },
        }),
      ]);

      logger.info(`Video READY for lesson ${lessonId}: ${manifestKey} (${totalBytes} bytes)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video processing failed';
      logger.error(`Video processing failed for lesson ${lessonId}:`, err);
      await prisma.videoAsset.update({
        where: { lessonId },
        data: { status: 'ERROR', errorMessage: message },
      }).catch(() => {});
    } finally {
      await fs.promises.unlink(uploadedPath).catch(() => {});
      await fs.promises.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }
  })();

  res.status(202).json({
    success: true,
    data: { lessonId, status: 'PROCESSING' },
    message: 'Video uploaded. Transcoding to 1080p HLS and uploading to private R2 storage.',
  });
});

export default router;
