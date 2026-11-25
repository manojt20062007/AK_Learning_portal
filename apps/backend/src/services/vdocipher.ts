import fs from 'fs';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const VDOCIPHER_BASE = 'https://dev.vdocipher.com/api';

export function isVdoCipherConfigured(): boolean {
  return Boolean(env.VIDEOCIPHER_API_SECRET && env.VIDEOCIPHER_API_SECRET.trim().length > 0);
}

function getApiSecret(): string {
  if (!isVdoCipherConfigured()) {
    throw new AppError(
      'VdoCipher is not configured. Add VIDEOCIPHER_API_SECRET in apps/backend/.env.',
      503,
      'VDOCIPHER_NOT_CONFIGURED',
    );
  }
  return env.VIDEOCIPHER_API_SECRET!.trim();
}

interface VdoCipherUploadCreds {
  videoId: string;
  clientPayload: {
    policy: string;
    key: string;
    'x-amz-signature': string;
    'x-amz-algorithm': string;
    'x-amz-date': string;
    'x-amz-credential': string;
    uploadLink: string;
  };
}

/**
 * Uploads an MP4 file directly to VdoCipher using their 2-step upload API.
 */
export async function uploadVideoToVdoCipher(
  localPath: string,
  title: string,
): Promise<{ videoId: string }> {
  const secret = getApiSecret();

  // 1. Obtain upload policy & credentials
  const credRes = await fetch(
    `${VDOCIPHER_BASE}/videos?title=${encodeURIComponent(title)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Apisecret ${secret}`,
      },
    },
  );

  if (!credRes.ok) {
    const errText = await credRes.text();
    throw new AppError(`VdoCipher upload init failed: ${errText}`, 502);
  }

  const creds = (await credRes.json()) as VdoCipherUploadCreds;
  const { clientPayload, videoId } = creds;

  // 2. Upload MP4 via multipart form POST to VdoCipher's uploadLink
  const fileBuffer = await fs.promises.readFile(localPath);
  const form = new FormData();
  form.append('policy', clientPayload.policy);
  form.append('key', clientPayload.key);
  form.append('x-amz-signature', clientPayload['x-amz-signature']);
  form.append('x-amz-algorithm', clientPayload['x-amz-algorithm']);
  form.append('x-amz-date', clientPayload['x-amz-date']);
  form.append('x-amz-credential', clientPayload['x-amz-credential']);
  form.append('success_action_status', '201');
  form.append('success_action_redirect', '');
  form.append('file', new Blob([fileBuffer], { type: 'video/mp4' }), 'video.mp4');

  const uploadRes = await fetch(clientPayload.uploadLink, {
    method: 'POST',
    body: form,
  });

  if (!uploadRes.ok && uploadRes.status !== 201) {
    const errText = await uploadRes.text();
    throw new AppError(`VdoCipher file upload failed (${uploadRes.status}): ${errText}`, 502);
  }

  return { videoId };
}

/**
 * Checks VdoCipher video processing status and duration.
 */
export async function getVdoCipherVideoInfo(videoId: string): Promise<{
  status: string;
  lengthSeconds: number;
}> {
  const secret = getApiSecret();
  const res = await fetch(`${VDOCIPHER_BASE}/videos/${encodeURIComponent(videoId)}`, {
    headers: { Authorization: `Apisecret ${secret}` },
  });

  if (!res.ok) {
    throw new AppError('Failed to fetch VdoCipher video status', 502);
  }

  const data = (await res.json()) as { status?: string; length?: number };
  return {
    status: data.status ?? 'Processing',
    lengthSeconds: Math.round(data.length ?? 0),
  };
}

/**
 * Generates a short-lived (5 min) DRM OTP + playbackInfo with a moving dynamic watermark.
 */
export async function generateVdoCipherOtp(
  videoId: string,
  watermarkText: string,
): Promise<{ otp: string; playbackInfo: string }> {
  const secret = getApiSecret();

  const annotate = JSON.stringify([
    {
      type: 'rtext',
      text: watermarkText,
      alpha: '0.65',
      color: '0xFFFFFF',
      size: '14',
      interval: '5000',
    },
  ]);

  const res = await fetch(`${VDOCIPHER_BASE}/videos/${encodeURIComponent(videoId)}/otp`, {
    method: 'POST',
    headers: {
      Authorization: `Apisecret ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ttl: 300,
      annotate,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new AppError(`VdoCipher OTP failed: ${errText}`, 502);
  }

  const data = (await res.json()) as { otp: string; playbackInfo: string };
  return data;
}
