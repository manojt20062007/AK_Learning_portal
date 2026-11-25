import { z } from 'zod';

// ---- User / Student Schemas ----

export const UserRole = z.enum(['ADMIN', 'STUDENT']);

export const CreateStudentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  courseId: z.string().uuid('Invalid course ID').optional().nullable(),
  sendInviteEmail: z.boolean().default(true),
  sendInviteWhatsApp: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateStudentSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
export type UserRoleType = z.infer<typeof UserRole>;
