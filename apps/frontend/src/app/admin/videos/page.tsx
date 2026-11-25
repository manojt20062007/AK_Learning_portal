'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video, HardDrive, Upload, CheckCircle, AlertTriangle,
  XCircle, Loader2, AlertCircle
} from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';

interface SystemCheck {
  ffmpeg: boolean;
  ffprobe: boolean;
  version?: string;
  r2Configured: boolean;
  vdoCipherConfigured: boolean;
  freeAllowanceGb: number;
}

interface StorageStats {
  usedBytes: number;
  usedGb: number;
  freeAllowanceGb: number;
  percentUsed: number;
  exceedsFreeTier: boolean;
  totalHours: number;
  videoCount: number;
  readyCount: number;
  assets: Array<{
    id: string;
    lessonId: string;
    lessonTitle: string;
    courseTitle: string;
    status: string;
    resolution?: string | null;
    durationSeconds?: number | null;
    fileSizeBytes: number;
    errorMessage?: string | null;
    processedAt?: string | null;
  }>;
}

interface CourseItem {
  id: string;
  title: string;
}

interface CourseDetail {
  id: string;
  title: string;
  sections: Array<{
    id: string;
    title: string;
    lessons: Array<{ id: string; title: string }>;
  }>;
}

export default function AdminVideosPage() {
  const router = useRouter();
  const [sys, setSys] = useState<SystemCheck | null>(null);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [provider, setProvider] = useState<'VIMEO' | 'R2_HLS' | 'VIDEOCIPHER'>('VIMEO');
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [vimeoMinutes, setVimeoMinutes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sysRes, stRes, cRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/videos/system-check`, { credentials: 'include' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/videos/storage`, { credentials: 'include' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses?limit=50`, { credentials: 'include' }),
      ]);
      if (sysRes.status === 401 || sysRes.status === 403) { router.push('/login'); return; }
      const sysJson = await sysRes.json();
      const stJson = await stRes.json();
      const cJson = await cRes.json();
      if (sysJson.success) setSys(sysJson.data);
      if (stJson.success) setStorage(stJson.data);
      if (cJson.success) setCourses(cJson.data);
    } catch {
      setError('Failed to load video system status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCourseId) { setCourseDetail(null); setSelectedLessonId(''); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${selectedCourseId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setCourseDetail(j.data);
          const firstLesson = j.data.sections?.[0]?.lessons?.[0]?.id ?? '';
          setSelectedLessonId(firstLesson);
        }
      })
      .catch(() => {});
  }, [selectedCourseId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedLessonId) {
      setError('Select a lesson');
      return;
    }

    if (provider === 'VIMEO') {
      if (!vimeoUrl.trim()) {
        setError('Enter a Vimeo URL or video ID');
        return;
      }
      setUploading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/videos/lessons/${selectedLessonId}/vimeo`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              vimeoUrl,
              durationMinutes: vimeoMinutes ? Number(vimeoMinutes) : undefined,
            }),
          },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || 'Failed to save Vimeo link');
          return;
        }
        setSuccess(json.message);
        setVimeoUrl('');
        setVimeoMinutes('');
        loadAll();
      } catch {
        setError('Failed to save Vimeo link');
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!file) {
      setError('Select an MP4 file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('video', file);

      const endpoint =
        provider === 'VIDEOCIPHER'
          ? `${process.env.NEXT_PUBLIC_API_URL}/admin/videos/lessons/${selectedLessonId}/upload-vdocipher`
          : `${process.env.NEXT_PUBLIC_API_URL}/admin/videos/lessons/${selectedLessonId}/upload`;

      const res = await fetch(endpoint, { method: 'POST', credentials: 'include', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Upload failed');
        return;
      }
      setSuccess(json.message);
      setFile(null);
      loadAll();
    } catch {
      setError('Upload request failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminShell title="Videos & R2 Storage">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            <button onClick={() => setError('')} className="ml-auto">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
        ) : (
          <>
            {/* System Readiness + Storage Monitor */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5 text-brand-600" /> Pipeline Readiness
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-600">FFmpeg & ffprobe (local transcode)</span>
                    {sys?.ffmpeg && sys?.ffprobe ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-xs">
                        <CheckCircle className="w-4 h-4" /> Installed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs">
                        <XCircle className="w-4 h-4" /> Not found in PATH
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-600">Cloudflare R2 (private bucket)</span>
                    {sys?.r2Configured ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-xs">
                        <CheckCircle className="w-4 h-4" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4" /> Set R2 keys in .env
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">VdoCipher DRM (5 GB free trial)</span>
                    {sys?.vdoCipherConfigured ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-xs">
                        <CheckCircle className="w-4 h-4" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4" /> Set VIDEOCIPHER_API_SECRET
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  Settings: 1920x1080 H.264, AAC 128k, CRF 24, medium preset, ~2–3 Mbps, 6s HLS segments.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-brand-600" /> R2 Storage Usage Monitor
                </h2>
                {storage && (
                  <>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold text-gray-900">{storage.usedGb} GB used</span>
                      <span className="text-gray-500">{storage.freeAllowanceGb} GB free allowance</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-3 rounded-full ${storage.exceedsFreeTier ? 'bg-red-500' : 'bg-brand-600'}`}
                        style={{ width: `${Math.min(100, storage.percentUsed)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span>{storage.readyCount} / {storage.videoCount} videos ready</span>
                      <span>{storage.totalHours}h total duration</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
                      R2 free storage is 10 GB-month. A 50+ hour 1080p library (~50–65 GB at 2.5 Mbps) will exceed the free allowance (~$0.015/GB-month overage).
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Upload MP4 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-600" /> Attach Lesson Video
              </h2>
              <form onSubmit={handleUpload} className="grid md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as 'VIMEO' | 'R2_HLS' | 'VIDEOCIPHER')}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="VIMEO">Vimeo Link (Paste URL)</option>
                    <option value="R2_HLS">Cloudflare R2 + FFmpeg</option>
                    <option value="VIDEOCIPHER">VdoCipher (DRM · 5 GB Free)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="">Select course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Lesson</label>
                  <select
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    disabled={!courseDetail}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">Select lesson...</option>
                    {courseDetail?.sections.flatMap((s) =>
                      s.lessons.map((l) => (
                        <option key={l.id} value={l.id}>{s.title} — {l.title}</option>
                      )),
                    )}
                  </select>
                </div>
                {provider === 'VIMEO' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Vimeo URL or Video ID *</label>
                    <input
                      type="text"
                      value={vimeoUrl}
                      onChange={(e) => setVimeoUrl(e.target.value)}
                      placeholder="https://vimeo.com/123456789"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">MP4 File</label>
                    <input
                      type="file"
                      accept="video/mp4,.mp4"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-semibold"
                    />
                  </div>
                )}
                <div className="md:col-span-4 flex items-center gap-3">
                  {provider === 'VIMEO' && (
                    <input
                      type="number"
                      min={1}
                      value={vimeoMinutes}
                      onChange={(e) => setVimeoMinutes(e.target.value)}
                      placeholder="Duration (min, optional)"
                      className="w-48 px-3 py-2.5 rounded-md border border-gray-200 text-sm bg-white"
                    />
                  )}
                  <button
                    type="submit"
                    disabled={uploading || !selectedLessonId || (provider === 'VIMEO' ? !vimeoUrl.trim() : !file)}
                    className="inline-flex items-center gap-2 bg-zinc-950 text-white font-medium px-5 py-2.5 rounded-md hover:bg-zinc-800 disabled:opacity-50 text-sm"
                  >
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : provider === 'VIMEO' ? 'Save Vimeo Link' : 'Upload Video'}
                  </button>
                </div>
              </form>
            </div>

            {/* Video Assets Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900 text-sm">
                Processed Video Assets
              </div>
              {!storage?.assets.length ? (
                <div className="p-10 text-center text-sm text-gray-400">No videos uploaded yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Course / Lesson</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Resolution</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Duration</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Size</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {storage.assets.map((a) => (
                      <tr key={a.id}>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-900">{a.lessonTitle}</div>
                          <div className="text-xs text-gray-400">{a.courseTitle}</div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">{a.resolution ?? '—'}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">
                          {a.durationSeconds ? `${Math.floor(a.durationSeconds / 60)}m ${a.durationSeconds % 60}s` : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">
                          {(a.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            a.status === 'READY'
                              ? 'bg-green-50 text-green-700'
                              : a.status === 'ERROR'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {a.status}
                          </span>
                          {a.errorMessage && (
                            <div className="text-xs text-red-600 mt-1">{a.errorMessage}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
