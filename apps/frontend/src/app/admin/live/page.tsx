'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Radio, Square, Trash2, Video, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';

interface CourseOption {
  id: string;
  title: string;
}

interface LiveSessionItem {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  provider: string;
  roomName: string;
  externalRoomUrl?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  recordingUrl?: string | null;
  course: { id: string; title: string; slug: string };
}

export default function AdminLivePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<LiveSessionItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [jaasConfigured, setJaasConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, cfgRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/live`, { credentials: 'include' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses?limit=50`, { credentials: 'include' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/live/config`, { credentials: 'include' }),
      ]);
      if (sRes.status === 401 || sRes.status === 403) { router.push('/login'); return; }
      const sJson = await sRes.json();
      const cJson = await cRes.json();
      const cfgJson = await cfgRes.json();
      if (sJson.success) setSessions(sJson.data);
      if (cfgJson.success) setJaasConfigured(Boolean(cfgJson.data?.jaasConfigured));
      if (cJson.success) {
        setCourses(cJson.data);
        if (!courseId && cJson.data.length > 0) setCourseId(cJson.data[0].id);
      }
    } catch {
      setError('Failed to load live sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          courseId,
          title,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.message || 'Failed to schedule'); return; }
      setShowCreate(false);
      setTitle('');
      setScheduledAt('');
      loadAll();
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: 'LIVE' | 'ENDED' | 'SCHEDULED') => {
    setError('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/live/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message || 'Failed to update status'); return; }
    loadAll();
  };

  const remove = async (id: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/live/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) loadAll();
  };

  return (
    <AdminShell
      title="Live Classes (Jitsi Meet)"
      actions={
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          className="inline-flex items-center gap-1.5 bg-zinc-950 text-white text-xs font-medium px-3.5 py-2 rounded-md hover:bg-zinc-800"
        >
          <Plus className="w-3.5 h-3.5" /> Schedule live class
        </button>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className={`border rounded-lg px-4 py-3 mb-6 text-xs ${
        jaasConfigured
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-blue-50 border-blue-200 text-blue-900'
      }`}>
        {jaasConfigured ? (
          <><strong>8x8 JaaS Host-Only Moderation Active:</strong> Admins join with a signed moderator JWT; enrolled students join as non-moderators and cannot kick or mute the host.</>
        ) : (
          <>Each live session generates a <strong>separate Jitsi room</strong> per course. To enforce strict host-only moderation on Jitsi, set <code>JAAS_APP_ID</code>, <code>JAAS_API_KEY_ID</code>, and <code>JAAS_PRIVATE_KEY</code> in your backend environment.</>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Video className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-600 mb-4">No live classes scheduled yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 bg-zinc-950 text-white text-xs font-medium px-4 py-2 rounded-md"
          >
            <Plus className="w-3.5 h-3.5" /> Schedule first class
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Session / Course</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Room</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Scheduled</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/70">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-zinc-950">{s.title}</div>
                    <div className="text-xs text-blue-700">{s.course.title}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-600">
                    {s.roomName}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600 tabular-nums">
                    {new Date(s.scheduledAt).toLocaleString('en-IN')} ({s.durationMinutes}m)
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                      s.status === 'LIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : s.status === 'ENDED'
                        ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {s.status === 'SCHEDULED' && (
                        <button
                          onClick={() => setStatus(s.id, 'LIVE')}
                          className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-emerald-700"
                        >
                          <Radio className="w-3 h-3" /> Go Live
                        </button>
                      )}
                      {s.status !== 'ENDED' && (
                        <Link
                          href={`/live/${s.id}`}
                          className="inline-flex items-center gap-1 bg-zinc-950 text-white text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-zinc-800"
                        >
                          Join as Host <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      {s.status === 'LIVE' && (
                        <button
                          onClick={() => setStatus(s.id, 'ENDED')}
                          className="inline-flex items-center gap-1 border border-zinc-300 text-zinc-700 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-zinc-100"
                        >
                          <Square className="w-3 h-3" /> End
                        </button>
                      )}
                      <button
                        onClick={() => remove(s.id)}
                        className="p-1.5 rounded-md border border-zinc-200 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-zinc-950">Schedule Course Live Session</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Course *</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm bg-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Session Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 1 Live Q&A"
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-zinc-950 text-white font-medium py-2.5 rounded-md hover:bg-zinc-800 disabled:opacity-50 text-sm"
              >
                {saving ? 'Scheduling...' : 'Create Course Meeting Room'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
