import { Router } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getCurrentUserId } from '../../middleware/auth';

const router = Router();

// GET /api/admin/settings - Get platform settings
router.get('/', async (_req, res) => {
  const settings = await prisma.platformSettings.findMany({
    orderBy: { key: 'asc' },
  });

  // Transform to key-value object (excluding sensitive values)
  const publicSettings: Record<string, string> = {};
  const sensitiveKeys = ['smtp_pass', 'r2_secret'];
  
  settings.forEach((s) => {
    if (!sensitiveKeys.some((k) => s.key.includes(k))) {
      publicSettings[s.key] = s.value;
    }
  });

  res.json({ success: true, data: publicSettings });
});

// PUT /api/admin/settings/upi - Update UPI settings
router.put('/upi', async (req, res) => {
  const adminId = getCurrentUserId(req);
  const { upiId, displayName, qrCodeUrl } = req.body as {
    upiId: string;
    displayName: string;
    qrCodeUrl?: string;
  };

  if (!upiId || upiId.trim().length < 5) {
    throw new AppError('Valid UPI ID is required', 400);
  }

  if (!displayName || displayName.trim().length < 2) {
    throw new AppError('Display name is required', 400);
  }

  const upsert = async (key: string, value: string, description: string) => {
    await prisma.platformSettings.upsert({
      where: { key },
      create: { key, value, description },
      update: { value },
    });
  };

  await Promise.all([
    upsert('upi_id', upiId.trim(), 'UPI ID for payment collection'),
    upsert('upi_display_name', displayName.trim(), 'Display name for UPI payment'),
    ...(qrCodeUrl ? [upsert('upi_qr_code_url', qrCodeUrl, 'URL of UPI QR code image')] : []),
  ]);

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'UPI_SETTINGS_UPDATED',
      description: `Updated UPI settings: ${upiId}`,
    },
  });

  res.json({ success: true, message: 'UPI settings updated successfully' });
});

// GET /api/admin/settings/upi - Get UPI settings (public-safe)
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

export default router;
