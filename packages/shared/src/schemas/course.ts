import { z } from 'zod';

// ---- Course Schemas ----

export const CourseLevel = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']);
export const CourseStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const CreateCourseSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  slug: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only')
    .optional(),
  shortDescription: z.string().min(20).max(500),
  description: z.string().min(50),
  categoryId: z.string().uuid(),
  level: CourseLevel.default('ALL_LEVELS'),
  language: z.string().default('English'),
  thumbnailUrl: z.string().url().optional().nullable(),
  previewVideoUrl: z.string().optional().nullable(),
  pricePaise: z.number().int().min(0).default(0),
  requirements: z.array(z.string()).default([]),
  whatYouLearn: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  durationHours: z.number().min(0).optional().nullable(),
});

export const UpdateCourseSchema = CreateCourseSchema.partial();

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  color: z.string().optional().nullable(),
});

export const CreateSectionSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const CreateLessonSchema = z.object({
  sectionId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  order: z.number().int().min(0).optional(),
  isFreePreview: z.boolean().default(false),
  durationSeconds: z.number().int().min(0).optional().nullable(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;
export type CourseLevelType = z.infer<typeof CourseLevel>;
export type CourseStatusType = z.infer<typeof CourseStatus>;
