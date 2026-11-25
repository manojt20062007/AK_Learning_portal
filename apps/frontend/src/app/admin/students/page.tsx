'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Loader2, CheckCircle, AlertCircle,
  MessageCircle, Copy, KeyRound, UserX, UserCheck, BookPlus, ExternalLink
} from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';

interface CourseOption {
  id: string;
  title: string;
  status: string;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  studentProfile: {
    id: string;
    studentId: string;
    phone: string;
    enrollments: Array<{
      id: string;
      status: string;
      course: { title: string };
    }>;
  } | null;
}

interface InvitePayload {
  studentId: string;
  email: string;
  name: string;
  setupLink?: string;
  emailSent?: boolean;
  whatsappMessage?: string;
  whatsappUrl?: string;
}

export default function AdminStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [creating, setCreating] = useState(false);

  // Invite / WhatsApp modal
  const [inviteData, setInviteData] = useState<InvitePayload | null>(null);
  const [copiedField, setCopiedField] = useState<'msg' | 'link' | null>(null);

  // Enroll modal
  const [enrollTarget, setEnrollTarget] = useState<StudentRow | null>(null);
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const loadData = async (q = search) => {
    setLoading(true);
    try {
      const qs = q ? `?search=${encodeURIComponent(q)}` : '';
      const [sRes, cRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students${qs}`, { credentials: 'include' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses?limit=50`, { credentials: 'include' }),
      ]);
      if (sRes.status === 401 || sRes.status === 403) {
        router.push('/login');
        return;
      }
      const sJson = await sRes.json();
      const cJson = await cRes.json();
      if (sJson.success) setStudents(sJson.data);
      if (cJson.success) setCourses(cJson.data);
    } catch {
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          phone,
          courseId: courseId || undefined,
          sendInviteEmail,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to create student');
        return;
      }
      setShowCreate(false);
      setName('');
      setEmail('');
      setPhone('');
      setCourseId('');
      setInviteData(json.data);
      loadData();
    } catch {
      setError('Could not connect to server');
    } finally {
      setCreating(false);
    }
  };

  const handleResetAccess = async (student: StudentRow) => {
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students/${student.id}/reset-access`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to reset access');
        return;
      }
      setInviteData({
        studentId: student.studentProfile?.studentId ?? '',
        email: student.email,
        name: student.name,
        ...json.data,
      });
    } catch {
      setError('Failed to reset access');
    }
  };

  const toggleActive = async (student: StudentRow) => {
    const action = student.isActive ? 'deactivate' : 'reactivate';
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students/${student.id}/${action}`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (res.ok) loadData();
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTarget || !enrollCourseId) return;
    setEnrolling(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students/${enrollTarget.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId: enrollCourseId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to enroll');
        return;
      }
      setEnrollTarget(null);
      setEnrollCourseId('');
      loadData();
    } finally {
      setEnrolling(false);
    }
  };

  const copyText = (text: string, type: 'msg' | 'link') => {
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <AdminShell
      title="Students"
      actions={
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          className="inline-flex items-center gap-1.5 bg-zinc-950 text-white text-xs font-medium px-3.5 py-2 rounded-md hover:bg-zinc-800"
        >
          <Plus className="w-3.5 h-3.5" /> Create student
        </button>
      }
    >
      <div>
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
            <button onClick={() => setError('')} className="ml-auto">✕</button>
          </div>
        )}

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); loadData(search); }}
          className="flex gap-2 mb-6 max-w-md"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or Student ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
            Search
          </button>
        </form>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500 text-sm">
            No students found. Click &ldquo;Create Student&rdquo; or approve a payment to add one.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Student ID</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Courses</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-brand-700">
                      {s.studentProfile?.studentId ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.email}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {s.studentProfile?.phone ? `+91 ${s.studentProfile.phone}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {s.studentProfile?.enrollments?.length
                        ? s.studentProfile.enrollments.map((e) => e.course.title).join(', ')
                        : 'None'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        s.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {s.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetAccess(s)}
                          title="Generate setup link & WhatsApp invite"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEnrollTarget(s); setEnrollCourseId(courses[0]?.id ?? ''); }}
                          title="Assign course"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <BookPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(s)}
                          title={s.isActive ? 'Deactivate' : 'Reactivate'}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                        >
                          {s.isActive ? <UserX className="w-3.5 h-3.5 text-red-500" /> : <UserCheck className="w-3.5 h-3.5 text-green-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Student Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Create Student Account</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone (10-digit) *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assign Course (optional)</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                >
                  <option value="">None</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={sendInviteEmail}
                  onChange={(e) => setSendInviteEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Send invitation email via Brevo SMTP
              </label>
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60 text-sm"
              >
                {creating ? 'Creating...' : 'Create Student & Generate Invite'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {enrollTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Assign Course</h2>
              <button onClick={() => setEnrollTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Student: <strong>{enrollTarget.name}</strong> ({enrollTarget.studentProfile?.studentId})
            </p>
            <form onSubmit={handleEnroll} className="space-y-4">
              <select
                value={enrollCourseId}
                onChange={(e) => setEnrollCourseId(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="">Select a course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={enrolling}
                className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 text-sm"
              >
                {enrolling ? 'Assigning...' : 'Assign Course'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invitation / WhatsApp Modal */}
      {inviteData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">Student Invitation Ready</h2>
              </div>
              <button onClick={() => setInviteData(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Student ID</span>
                <span className="font-mono font-bold text-brand-700">{inviteData.studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email (Brevo)</span>
                <span className={inviteData.emailSent ? 'text-green-700 font-medium' : 'text-amber-700 text-xs'}>
                  {inviteData.emailSent ? 'Sent via Brevo ✓' : 'SMTP not configured (send link manually)'}
                </span>
              </div>
            </div>

            {inviteData.whatsappMessage && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Pre-typed WhatsApp Message
                </label>
                <textarea
                  readOnly
                  rows={6}
                  value={inviteData.whatsappMessage}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 text-gray-800 font-sans"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {inviteData.whatsappUrl && (
                <a
                  href={inviteData.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-green-700 text-sm"
                >
                  <MessageCircle className="w-4 h-4" /> Send via WhatsApp <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {inviteData.whatsappMessage && (
                <button
                  onClick={() => copyText(inviteData.whatsappMessage!, 'msg')}
                  className="inline-flex items-center gap-1.5 border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-50"
                >
                  <Copy className="w-3.5 h-3.5" /> {copiedField === 'msg' ? 'Copied!' : 'Copy Message'}
                </button>
              )}
              {inviteData.setupLink && (
                <button
                  onClick={() => copyText(inviteData.setupLink!, 'link')}
                  className="inline-flex items-center gap-1.5 border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-50"
                >
                  <Copy className="w-3.5 h-3.5" /> {copiedField === 'link' ? 'Copied!' : 'Copy Setup Link'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
