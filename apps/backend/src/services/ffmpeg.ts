import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/errorHandler';

const execFileAsync = promisify(execFile);

export interface VideoProbeResult {
  durationSeconds: number;
  resolution: string;
  bitrateBps: number;
}

export async function checkFfmpegAvailable(): Promise<{ ffmpeg: boolean; ffprobe: boolean; version?: string }> {
  let ffmpegOk = false;
  let ffprobeOk = false;
  let version: string | undefined;

  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    ffmpegOk = true;
    version = stdout.split('\n')[0]?.trim();
  } catch {
    ffmpegOk = false;
  }

  try {
    await execFileAsync('ffprobe', ['-version'], { timeout: 5000 });
    ffprobeOk = true;
  } catch {
    ffprobeOk = false;
  }

  return { ffmpeg: ffmpegOk, ffprobe: ffprobeOk, version };
}

export async function probeVideo(inputPath: string): Promise<VideoProbeResult> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath,
    ]);
    const info = JSON.parse(stdout) as {
      format?: { duration?: string; bit_rate?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };

    const videoStream = info.streams?.find((s) => s.codec_type === 'video');
    const durationSeconds = Math.round(parseFloat(info.format?.duration ?? '0'));
    const bitrateBps = Math.round(parseFloat(info.format?.bit_rate ?? '0'));
    const resolution =
      videoStream?.width && videoStream?.height
        ? `${videoStream.width}x${videoStream.height}`
        : '1920x1080';

    return { durationSeconds, resolution, bitrateBps };
  } catch {
    throw new AppError(
      'ffprobe failed. Ensure FFmpeg/ffprobe is installed and in your system PATH.',
      503,
      'FFMPEG_NOT_AVAILABLE',
    );
  }
}

/**
 * Compresses an MP4 and packages it as 6-second VOD HLS segments.
 * Target settings: max 1920x1080, H.264, AAC 128k, CRF 24, medium preset, ~2-3 Mbps.
 */
export async function transcodeToHls(inputPath: string, outputDir: string): Promise<string> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, 'master.m3u8');
  const segmentPattern = path.join(outputDir, 'seg_%03d.ts');

  const args = [
    '-y',
    '-i', inputPath,
    '-vf', "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
    '-c:v', 'libx264',
    '-crf', '24',
    '-preset', 'medium',
    '-maxrate', '3000k',
    '-bufsize', '6000k',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', segmentPattern,
    manifestPath,
  ];

  try {
    await execFileAsync('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });
    return manifestPath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'FFmpeg transcoding failed';
    throw new AppError(`FFmpeg transcode error: ${msg}`, 500, 'TRANSCODE_FAILED');
  }
}
