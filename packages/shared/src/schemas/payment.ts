import { z } from 'zod';

// ---- Payment Schemas ----

export const PaymentStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED']);

export const SubmitPaymentSchema = z.object({
  courseId: z.string().uuid(),
  studentName: z.string().min(2).max(200),
  studentEmail: z.string().email(),
  studentPhone: z.string().regex(/^[6-9]\d{9}$/),
  utrNumber: z
    .string()
    .min(6, 'UTR must be at least 6 characters')
    .max(50)
    .regex(/^[A-Z0-9]+$/i, 'UTR must be alphanumeric'),
  paymentDate: z.string().datetime().or(z.string().date()),
  amountPaise: z.number().int().min(1, 'Amount must be greater than 0'),
  paymentApp: z.enum(['GOOGLE_PAY', 'PHONEPE', 'PAYTM', 'BHIM', 'OTHER']).optional(),
  screenshotUrl: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const VerifyPaymentSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(1000).optional().nullable(),
  adminNotes: z.string().max(1000).optional().nullable(),
});

export const UpiSettingsSchema = z.object({
  upiId: z.string().min(5).max(100),
  displayName: z.string().min(2).max(200),
  qrCodeUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type SubmitPaymentInput = z.infer<typeof SubmitPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type UpiSettingsInput = z.infer<typeof UpiSettingsSchema>;
export type PaymentStatusType = z.infer<typeof PaymentStatus>;
