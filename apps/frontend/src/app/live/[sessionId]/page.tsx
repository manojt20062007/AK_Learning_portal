'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Radio } from 'lucide-react';

interface JoinPayload {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  roomName: string;
  jitsiDomain: string;
  displayName: string;
  email: string;
  isHost: boolean;
  status: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        parentNode: HTMLElement;
        width?: string | number;
        height?: string | number;
        userInfo?: { displayName?: string; email?: string };
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      },
    ) => { dispose: () => void };
  }
}

export default function LiveClassroomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [info, setInfo] = useState<JoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let apiInstance: { dispose: () => void } | null = null;
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live/${sessionId}/join`, {
          credentials: 'include',
        });
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (!cancelled) setError(json.message || 'Unable to join live session');
          return;
        }
        if (cancelled) return;

        const payload = json.data as JoinPayload;
        setInfo(payload);

        // Load Jitsi Meet external API script
        await new Promise<void>((resolve, reject) => {
          if (window.JitsiMeetExternalAPI) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = `https://${payload.jitsiDomain}/external_api.js`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Jitsi Meet'));
          document.body.appendChild(script);
        });

        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

        apiInstance = new window.JitsiMeetExternalAPI(payload.jitsiDomain, {
          roomName: payload.roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: payload.displayName,
            email: payload.email,
          },
          configOverwrite: {
            prejoinPageEnabled: true,
            disableDeepLinking: true,
          },
        });
      } catch {
        if (!cancelled) setError('Could not load Jitsi live classroom');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      apiInstance?.dispose();
    };
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="h-14 px-4 sm:px-6 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={info?.isHost ? '/admin/live' : '/dashboard'}
            className="text-zinc-400 hover:text-white flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{info?.title ?? 'Live Classroom'}</div>
            {info && <div className="text-xs text-zinc-400 truncate">{info.courseTitle}</div>}
          </div>
        </div>
        {info && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full flex-shrink-0">
            <Radio className="w-3.5 h-3.5" /> {info.status}
          </span>
        )}
      </header>

      <main className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
            <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-sm text-zinc-200 max-w-md mb-4">{error}</p>
            <Link href="/dashboard" className="text-xs font-medium text-blue-400 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-[calc(100vh-3.5rem)]" />
        )}
      </main>
    </div>
  );
}
