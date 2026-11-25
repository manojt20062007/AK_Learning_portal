'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ProtectedHlsPlayerProps {
  lessonId: string;
  initialPosition?: number;
  onEnded?: () => void;
}

interface SessionPayload {
  provider?: 'R2_HLS' | 'VIDEOCIPHER';
  playbackSessionId: string | null;
  playlistUrl?: string;
  otp?: string;
  playbackInfo?: string;
  durationSeconds: number;
  watermark: {
    studentId: string;
    studentName: string;
  };
}

const WATERMARK_POSITIONS = [
  'top-4 left-4',
  'top-4 right-4',
  'bottom-14 left-4',
  'bottom-14 right-4',
  'top-1/3 left-1/3',
  'top-1/2 right-10',
];

export default function ProtectedHlsPlayer({
  lessonId,
  initialPosition = 0,
  onEnded,
}: ProtectedHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [wmIndex, setWmIndex] = useState(0);

  // Move watermark every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setWmIndex((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Authorize playback & initialize HLS.js
  useEffect(() => {
    let hls: Hls | null = null;
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/video/lessons/${lessonId}/session`,
          { method: 'POST', credentials: 'include' },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (!cancelled) setError(json.message || 'Unable to load video');
          return;
        }
        if (cancelled) return;

        const payload = json.data as SessionPayload;
        setSession(payload);

        if (payload.provider === 'VIDEOCIPHER') {
          return;
        }

        const video = videoRef.current;
        if (!video || !payload.playlistUrl) return;

        const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');
        const fullPlaylistUrl = `${apiOrigin}${payload.playlistUrl}`;

        if (Hls.isSupported()) {
          hls = new Hls({
            xhrSetup: (xhr, url) => {
              // Send session cookie only to our API manifest endpoint, not to signed R2 segment URLs
              if (url.startsWith(apiOrigin)) {
                xhr.withCredentials = true;
              }
            },
          });
          hls.loadSource(fullPlaylistUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (initialPosition > 0) {
              video.currentTime = initialPosition;
            }
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !cancelled) {
              setError('Playback error occurred. Please refresh to get a new signed stream.');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = fullPlaylistUrl;
          if (initialPosition > 0) {
            video.currentTime = initialPosition;
          }
        } else {
          setError('HLS playback is not supported in this browser.');
        }
      } catch {
        if (!cancelled) setError('Could not connect to video server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [lessonId, initialPosition]);

  // Playback heartbeat every 15s while playing
  useEffect(() => {
    if (!session?.playbackSessionId) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/video/sessions/${session.playbackSessionId}/heartbeat`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentTimeSeconds: Math.floor(video.currentTime),
          watchedDeltaSeconds: 15,
        }),
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [session?.playbackSessionId]);

  return (
    <div
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 text-white z-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-white p-6 text-center z-20">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm text-gray-200 max-w-md">{error}</p>
        </div>
      )}

      {session?.provider === 'VIDEOCIPHER' && session.otp && session.playbackInfo ? (
        <iframe
          src={`https://player.vdocipher.com/v2/?otp=${encodeURIComponent(session.otp)}&playbackInfo=${encodeURIComponent(session.playbackInfo)}`}
          className="w-full h-full border-0"
          allow="encrypted-media"
          allowFullScreen
        />
      ) : (
        <>
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            playsInline
            onEnded={onEnded}
            className="w-full h-full object-contain"
          />

          {session && !error && (
            <div
              className={`pointer-events-none absolute ${WATERMARK_POSITIONS[wmIndex]} z-10 transition-all duration-700`}
            >
              <div className="bg-black/45 backdrop-blur-sm text-white/75 text-[11px] font-mono px-2.5 py-1 rounded border border-white/10">
                {session.watermark.studentId} · {session.watermark.studentName}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
