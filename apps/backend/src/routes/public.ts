import { Router } from 'express';
import { prisma } from '../config/database';

const router = Router();

// GET /api/public/courses - Public course listing
router.get('/courses', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
  const search = (req.query.search as string) || '';
  const categorySlug = req.query.category as string | undefined;
  const level = req.query.level as string | undefined;

  const where = {
    status: 'PUBLISHED' as const,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { shortDescription: { contains: search, mode: 'insensitive' as const } },
        { tags: { has: search } },
      ],
    }),
    ...(categorySlug && { category: { slug: categorySlug } }),
    ...(level && { level: level as never }),
  };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        thumbnailUrl: true,
        level: true,
        language: true,
        pricePaise: true,
        durationHours: true,
        totalLessons: true,
        enrollmentCount: true,
        tags: true,
        publishedAt: true,
        category: { select: { id: true, name: true, slug: true, color: true } },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  res.json({
    success: true,
    data: courses,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/public/courses/:slug - Single course details (public)
router.get('/courses/:slug', async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { slug: req.params.slug, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      description: true,
      thumbnailUrl: true,
      level: true,
      language: true,
      pricePaise: true,
      durationHours: true,
      totalLessons: true,
      enrollmentCount: true,
      requirements: true,
      whatYouLearn: true,
      tags: true,
      publishedAt: true,
      category: { select: { id: true, name: true, slug: true, color: true } },
      sections: {
        where: {},
        select: {
          id: true,
          title: true,
          order: true,
          lessons: {
            select: {
              id: true,
              title: true,
              order: true,
              isFreePreview: true,
              durationSeconds: true,
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  return res.json({ success: true, data: course });
});

// GET /api/public/categories - All active categories
router.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconUrl: true,
      color: true,
      _count: { select: { courses: true } },
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });

  res.json({ success: true, data: categories });
});

// GET /api/public/upi - UPI payment details for joining requests
router.get('/upi', async (_req, res) => {
  const [upiId, displayName, qrCodeUrl] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { key: 'upi_id' } }),
    prisma.platformSettings.findUnique({ where: { key: 'upi_display_name' } }),
    prisma.platformSettings.findUnique({ where: { key: 'upi_qr_code_url' } }),
  ]);

  res.json({
    success: true,
    data: {
      upiId: upiId?.value ?? null,
      displayName: displayName?.value ?? null,
      qrCodeUrl: qrCodeUrl?.value ?? null,
    },
  });
});

// GET /api/public/certificates/verify/:code - Public certificate verification
router.get('/certificates/verify/:code', async (req, res) => {
  const code = req.params.code.trim();

  const cert = await prisma.certificate.findFirst({
    where: {
      OR: [{ verificationCode: code }, { certificateNumber: code }],
    },
    include: {
      studentProfile: {
        select: {
          studentId: true,
          user: { select: { name: true } },
        },
      },
      course: {
        select: {
          title: true,
          slug: true,
          durationHours: true,
          level: true,
        },
      },
    },
  });

  if (!cert) {
    return res.status(404).json({
      success: false,
      message: 'Certificate not found or invalid verification code',
    });
  }

  return res.json({
    success: true,
    data: {
      certificateNumber: cert.certificateNumber,
      verificationCode: cert.verificationCode,
      issuedAt: cert.issuedAt,
      studentName: cert.studentProfile.user.name,
      studentId: cert.studentProfile.studentId,
      courseTitle: cert.course.title,
      courseSlug: cert.course.slug,
      durationHours: cert.course.durationHours,
      level: cert.course.level,
    },
  });
});

export default router;
