import { Router } from 'express';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';
import { getCurrentUserId } from '../../middleware/auth';
import { NotFoundError, ConflictError, AppError } from '../../middleware/errorHandler';
import { CreateCourseSchema, UpdateCourseSchema } from '@ak-learning/shared';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { CourseStatus } from '@prisma/client';

const router = Router();

// Helper: generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 190);
}

// Helper: audit log
async function auditLog(adminId: string, action: string, entityId: string, description: string, metadata?: Record<string, unknown>) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action: action as never,
        entityType: 'Course',
        entityId,
        description,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log:', err);
  }
}

// GET /api/admin/courses - List all courses
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const search = (req.query.search as string) || '';
  const status = req.query.status as CourseStatus | undefined;
  const categoryId = req.query.categoryId as string | undefined;

  const where = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { shortDescription: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(status && { status }),
    ...(categoryId && { categoryId }),
  };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { sections: true, enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
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

// GET /api/admin/courses/:id - Get single course with full details
router.get('/:id', async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: {
      category: true,
      sections: {
        include: {
          lessons: {
            include: {
              videoAsset: true,
              resources: true,
              quiz: { select: { id: true, title: true, isPublished: true } },
              _count: { select: { lessonProgress: true } },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { enrollments: true, reviews: true },
      },
    },
  });

  if (!course) throw new NotFoundError('Course');

  const serialized = {
    ...course,
    sections: course.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => ({
        ...l,
        videoAsset: l.videoAsset
          ? {
              ...l.videoAsset,
              fileSizeBytes: l.videoAsset.fileSizeBytes ? Number(l.videoAsset.fileSizeBytes) : null,
            }
          : null,
        resources: l.resources.map((r) => ({
          ...r,
          fileSize: r.fileSize ? Number(r.fileSize) : null,
        })),
      })),
    })),
  };

  res.json({ success: true, data: serialized });
});

// POST /api/admin/courses - Create a new course
router.post('/', validate(CreateCourseSchema), async (req, res) => {
  const adminId = getCurrentUserId(req);
  const body = req.body as z.infer<typeof CreateCourseSchema>;

  // Generate slug if not provided
  let slug = body.slug || generateSlug(body.title);

  // Ensure unique slug
  const existingSlug = await prisma.course.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  // Validate category exists
  const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!category) throw new NotFoundError('Category');

  const course = await prisma.course.create({
    data: {
      title: body.title,
      slug,
      shortDescription: body.shortDescription,
      description: body.description,
      categoryId: body.categoryId,
      level: body.level ?? 'ALL_LEVELS',
      language: body.language ?? 'English',
      thumbnailUrl: body.thumbnailUrl ?? null,
      pricePaise: body.pricePaise ?? 0,
      requirements: body.requirements ?? [],
      whatYouLearn: body.whatYouLearn ?? [],
      tags: body.tags ?? [],
      durationHours: body.durationHours ?? null,
    },
    include: { category: true },
  });

  await auditLog(adminId, 'COURSE_CREATED', course.id, `Created course: ${course.title}`);

  res.status(201).json({ success: true, data: course, message: 'Course created successfully' });
});

// PATCH /api/admin/courses/:id - Update course
router.patch('/:id', validate(UpdateCourseSchema), async (req, res) => {
  const adminId = getCurrentUserId(req);
  const body = req.body as z.infer<typeof UpdateCourseSchema>;

  const existing = await prisma.course.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new NotFoundError('Course');

  // Handle slug update
  let slug = existing.slug;
  if (body.slug && body.slug !== existing.slug) {
    const conflict = await prisma.course.findFirst({
      where: { slug: body.slug, NOT: { id: String(req.params.id) } },
    });
    if (conflict) throw new ConflictError('A course with this slug already exists');
    slug = body.slug;
  } else if (body.title && !body.slug) {
    // Auto-update slug if title changed and no explicit slug
    slug = generateSlug(body.title);
    const conflict = await prisma.course.findFirst({
      where: { slug, NOT: { id: String(req.params.id) } },
    });
    if (conflict) slug = `${slug}-${Date.now()}`;
  }

  const course = await prisma.course.update({
    where: { id: String(req.params.id) },
    data: {
      ...(body.title && { title: body.title }),
      slug,
      ...(body.shortDescription && { shortDescription: body.shortDescription }),
      ...(body.description && { description: body.description }),
      ...(body.categoryId && { categoryId: body.categoryId }),
      ...(body.level && { level: body.level }),
      ...(body.language && { language: body.language }),
      ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl }),
      ...(body.pricePaise !== undefined && { pricePaise: body.pricePaise }),
      ...(body.requirements && { requirements: body.requirements }),
      ...(body.whatYouLearn && { whatYouLearn: body.whatYouLearn }),
      ...(body.tags && { tags: body.tags }),
      ...(body.durationHours !== undefined && { durationHours: body.durationHours }),
    },
    include: { category: true },
  });

  await auditLog(adminId, 'COURSE_UPDATED', course.id, `Updated course: ${course.title}`);

  res.json({ success: true, data: course, message: 'Course updated successfully' });
});

// POST /api/admin/courses/:id/publish - Publish a course
router.post('/:id/publish', async (req, res) => {
  const adminId = getCurrentUserId(req);

  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { sections: true } } },
  });
  if (!course) throw new NotFoundError('Course');

  if (course.status === 'PUBLISHED') {
    throw new AppError('Course is already published', 400);
  }

  if (course._count.sections === 0) {
    throw new AppError('Cannot publish a course with no sections', 400);
  }

  const updated = await prisma.course.update({
    where: { id: req.params.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  await auditLog(adminId, 'COURSE_PUBLISHED', course.id, `Published course: ${course.title}`);

  res.json({ success: true, data: updated, message: 'Course published successfully' });
});

// POST /api/admin/courses/:id/archive - Archive a course
router.post('/:id/archive', async (req, res) => {
  const adminId = getCurrentUserId(req);

  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) throw new NotFoundError('Course');

  if (course.status === 'ARCHIVED') {
    throw new AppError('Course is already archived', 400);
  }

  const updated = await prisma.course.update({
    where: { id: req.params.id },
    data: { status: 'ARCHIVED' },
  });

  await auditLog(adminId, 'COURSE_ARCHIVED', course.id, `Archived course: ${course.title}`);

  res.json({ success: true, data: updated, message: 'Course archived successfully' });
});

// POST /api/admin/courses/:id/draft - Revert to draft
router.post('/:id/draft', async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) throw new NotFoundError('Course');

  const updated = await prisma.course.update({
    where: { id: req.params.id },
    data: { status: 'DRAFT' },
  });

  res.json({ success: true, data: updated, message: 'Course reverted to draft' });
});

// DELETE /api/admin/courses/:id - Delete a course (only DRAFT courses)
router.delete('/:id', async (req, res) => {
  const adminId = getCurrentUserId(req);

  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!course) throw new NotFoundError('Course');

  if (course.status === 'PUBLISHED') {
    throw new AppError('Cannot delete a published course. Archive it first.', 400);
  }

  if (course._count.enrollments > 0) {
    throw new AppError('Cannot delete a course with active enrollments', 400);
  }

  await prisma.course.delete({ where: { id: req.params.id } });

  await auditLog(adminId, 'COURSE_DELETED', course.id, `Deleted course: ${course.title}`);

  res.json({ success: true, message: 'Course deleted successfully' });
});

// ============================================================
// SECTION ROUTES
// ============================================================

// POST /api/admin/courses/:id/sections
router.post('/:id/sections', async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) throw new NotFoundError('Course');

  const { title, description } = req.body as { title: string; description?: string };
  if (!title || title.trim().length < 2) {
    throw new AppError('Section title must be at least 2 characters', 400);
  }

  const lastSection = await prisma.section.findFirst({
    where: { courseId: req.params.id },
    orderBy: { order: 'desc' },
  });

  const section = await prisma.section.create({
    data: {
      courseId: req.params.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      order: (lastSection?.order ?? -1) + 1,
    },
  });

  res.status(201).json({ success: true, data: section, message: 'Section created' });
});

// PATCH /api/admin/courses/:id/sections/:sectionId
router.patch('/:id/sections/:sectionId', async (req, res) => {
  const section = await prisma.section.findFirst({
    where: { id: req.params.sectionId, courseId: req.params.id },
  });
  if (!section) throw new NotFoundError('Section');

  const { title, description, order } = req.body as {
    title?: string;
    description?: string;
    order?: number;
  };

  const updated = await prisma.section.update({
    where: { id: req.params.sectionId },
    data: {
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(order !== undefined && { order }),
    },
  });

  res.json({ success: true, data: updated });
});

// DELETE /api/admin/courses/:id/sections/:sectionId
router.delete('/:id/sections/:sectionId', async (req, res) => {
  const section = await prisma.section.findFirst({
    where: { id: req.params.sectionId, courseId: req.params.id },
    include: { _count: { select: { lessons: true } } },
  });
  if (!section) throw new NotFoundError('Section');

  if (section._count.lessons > 0) {
    throw new AppError('Cannot delete a section with lessons. Remove lessons first.', 400);
  }

  await prisma.section.delete({ where: { id: req.params.sectionId } });

  res.json({ success: true, message: 'Section deleted' });
});

// ============================================================
// LESSON ROUTES
// ============================================================

// POST /api/admin/courses/:id/sections/:sectionId/lessons
router.post('/:id/sections/:sectionId/lessons', async (req, res) => {
  const section = await prisma.section.findFirst({
    where: { id: req.params.sectionId, courseId: req.params.id },
  });
  if (!section) throw new NotFoundError('Section');

  const { title, description, isFreePreview, thumbnailUrl } = req.body as {
    title: string;
    description?: string;
    isFreePreview?: boolean;
    thumbnailUrl?: string | null;
  };

  if (!title || title.trim().length < 2) {
    throw new AppError('Lesson title must be at least 2 characters', 400);
  }

  const lastLesson = await prisma.lesson.findFirst({
    where: { sectionId: req.params.sectionId },
    orderBy: { order: 'desc' },
  });

  const lesson = await prisma.lesson.create({
    data: {
      sectionId: req.params.sectionId,
      title: title.trim(),
      description: description?.trim() ?? null,
      thumbnailUrl: thumbnailUrl?.trim() || null,
      isFreePreview: isFreePreview ?? false,
      order: (lastLesson?.order ?? -1) + 1,
    },
  });

  const totalLessons = await prisma.lesson.count({
    where: { section: { courseId: req.params.id } },
  });
  await prisma.course.update({
    where: { id: req.params.id },
    data: { totalLessons },
  });

  res.status(201).json({ success: true, data: lesson, message: 'Lesson created' });
});

// PATCH /api/admin/courses/:id/sections/:sectionId/lessons/:lessonId
router.patch('/:id/sections/:sectionId/lessons/:lessonId', async (req, res) => {
  const lesson = await prisma.lesson.findFirst({
    where: { id: req.params.lessonId, sectionId: req.params.sectionId },
  });
  if (!lesson) throw new NotFoundError('Lesson');

  const { title, description, isFreePreview, order, thumbnailUrl } = req.body as {
    title?: string;
    description?: string;
    isFreePreview?: boolean;
    order?: number;
    thumbnailUrl?: string | null;
  };

  const updated = await prisma.lesson.update({
    where: { id: req.params.lessonId },
    data: {
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl?.trim() || null }),
      ...(isFreePreview !== undefined && { isFreePreview }),
      ...(order !== undefined && { order }),
    },
  });

  res.json({ success: true, data: updated });
});

// DELETE /api/admin/courses/:id/sections/:sectionId/lessons/:lessonId
router.delete('/:id/sections/:sectionId/lessons/:lessonId', async (req, res) => {
  const lesson = await prisma.lesson.findFirst({
    where: { id: req.params.lessonId, sectionId: req.params.sectionId },
  });
  if (!lesson) throw new NotFoundError('Lesson');

  await prisma.lesson.delete({ where: { id: req.params.lessonId } });

  const totalLessons = await prisma.lesson.count({
    where: { section: { courseId: req.params.id } },
  });
  await prisma.course.update({
    where: { id: req.params.id },
    data: { totalLessons },
  });

  res.json({ success: true, message: 'Lesson deleted' });
});

// POST /api/admin/courses/:id/sections/:sectionId/lessons/:lessonId/resources
router.post('/:id/sections/:sectionId/lessons/:lessonId/resources', async (req, res) => {
  const lesson = await prisma.lesson.findFirst({
    where: { id: req.params.lessonId, sectionId: req.params.sectionId },
  });
  if (!lesson) throw new NotFoundError('Lesson');

  const { title, type, url } = req.body as {
    title?: string;
    type?: string;
    url?: string;
  };

  if (!title || title.trim().length < 2) {
    throw new AppError('Resource title is required', 400);
  }
  if (!url || !url.trim()) {
    throw new AppError('Resource URL is required', 400);
  }

  const resource = await prisma.lessonResource.create({
    data: {
      lessonId: lesson.id,
      title: title.trim(),
      type: (type || 'PDF').toUpperCase(),
      url: url.trim(),
    },
  });

  res.status(201).json({
    success: true,
    data: { ...resource, fileSize: resource.fileSize ? Number(resource.fileSize) : null },
    message: 'Resource attached',
  });
});

// DELETE /api/admin/courses/:id/sections/:sectionId/lessons/:lessonId/resources/:resourceId
router.delete('/:id/sections/:sectionId/lessons/:lessonId/resources/:resourceId', async (req, res) => {
  const resource = await prisma.lessonResource.findFirst({
    where: { id: req.params.resourceId, lessonId: req.params.lessonId },
  });
  if (!resource) throw new NotFoundError('Resource');

  await prisma.lessonResource.delete({ where: { id: resource.id } });
  res.json({ success: true, message: 'Resource deleted' });
});

export default router;
