'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Award, Bell, CreditCard, Settings, LogOut,
  Loader2, CheckCircle, Play, AlertCircle, Radio
} from 'lucide-react';
import BrandLogo from '@/components/layout/BrandLogo';
import BrandLoader from '@/components/layout/BrandLoader';

interface Enrollment {
  id: string;
  status: string;
  progressPercent: number;
  enrolledAt: string;
  course: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    thumbnailUrl?: string | null;
    level: string;
    durationHours?: number | null;
    totalLessons: number;
    category?: { name: string } | null;
  };
}

interface DashboardData {
  student: {
    id: string;
    name: string;
    email: string;
    studentId: string;
    phone: string;
    memberSince: string;
  };
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    certificates: number;
    unreadNotifications: number;
  };
  enrollments: Enrollment[];
}

interface PaymentRecord {
  id: string;
  utrNumber: string;
  amountPaise: number;
  paymentDate: string;
  status: string;
}

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface LiveSessionItem {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  course: { id: string; title: string };
}

type TabKey = 'courses' | 'payments' | 'notifications' | 'settings';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('courses');
  const [data, setData] = useState<DashboardData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/dashboard`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message || 'Failed to load dashboard');

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/live/my-sessions`, { credentials: 'include' })
        .then((r) => r.json())
        .then((lj) => { if (lj.success) setLiveSessions(lj.data); })
        .catch(() => {});
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'payments') {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/payments`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (j.success) setPayments(j.data); })
        .catch(() => {});
    } else if (tab === 'notifications') {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/notifications`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (j.success) setNotifications(j.data); })
        .catch(() => {});
    }
  }, [tab]);

  const markRead = async (id: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    loadDashboard();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMsg('');
    setPwLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPwError(json.message || 'Failed to update password');
        return;
      }
      setPwMsg('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setPwError('Unable to connect to server');
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/login');
  };

  if (loading) {
    return <BrandLoader label="Loading your dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <BrandLogo size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            {data && (
              <span className="hidden sm:inline-flex items-center font-mono text-xs font-medium bg-zinc-100 border border-zinc-200 text-zinc-800 px-2.5 py-1 rounded">
                {data.student.studentId}
              </span>
            )}
            <button
              onClick={() => setTab('notifications')}
              className="relative p-1.5 text-zinc-500 hover:text-zinc-950 rounded-md hover:bg-zinc-100"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {data && data.stats.unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-red-700 px-2.5 py-1.5 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {data && (
          <>
            {/* Clean Student Summary Header */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                    {data.student.studentId}
                  </span>
                  <span className="text-xs text-zinc-500">{data.student.email}</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
                  {data.student.name}
                </h1>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-6 border-t md:border-t-0 md:border-l border-zinc-200 pt-4 md:pt-0 md:pl-6">
                <div>
                  <div className="text-xl font-bold text-zinc-950 tabular-nums">{data.stats.enrolledCourses}</div>
                  <div className="text-xs text-zinc-500">Enrolled</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-zinc-950 tabular-nums">{data.stats.completedCourses}</div>
                  <div className="text-xs text-zinc-500">Completed</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-zinc-950 tabular-nums">{data.stats.certificates}</div>
                  <div className="text-xs text-zinc-500">Certificates</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-6 border-b border-zinc-200 pb-3">
              {[
                { key: 'courses' as const, label: 'My Courses', icon: BookOpen },
                { key: 'payments' as const, label: 'Payment History', icon: CreditCard },
                { key: 'notifications' as const, label: `Notifications (${data.stats.unreadNotifications})`, icon: Bell },
                { key: 'settings' as const, label: 'Account Settings', icon: Settings },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-zinc-950 text-white'
                      : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>

            {/* My Courses */}
            {tab === 'courses' && (
              <div className="space-y-6">
                {liveSessions.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 mb-3">
                      <Radio className="w-4 h-4 text-emerald-600" />
                      Upcoming &amp; Live Classes
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {liveSessions.map((ls) => (
                        <div key={ls.id} className="border border-zinc-200 rounded-lg p-3.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-blue-700 truncate">{ls.course.title}</div>
                            <div className="text-sm font-semibold text-zinc-950 truncate">{ls.title}</div>
                            <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                              {new Date(ls.scheduledAt).toLocaleString('en-IN')} · {ls.durationMinutes}m
                            </div>
                          </div>
                          {ls.status !== 'ENDED' && (
                            <Link
                              href={`/live/${ls.id}`}
                              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-md ${
                                ls.status === 'LIVE'
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-zinc-950 text-white hover:bg-zinc-800'
                              }`}
                            >
                              {ls.status === 'LIVE' ? 'Join Live' : 'Open Room'}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.enrollments.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
                  <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-zinc-900 mb-1">No enrolled courses yet</h2>
                  <p className="text-sm text-zinc-500 mb-5">Browse the catalog to enroll in a course.</p>
                  <Link
                    href="/courses"
                    className="inline-flex items-center bg-zinc-950 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-zinc-800"
                  >
                    Browse courses
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {data.enrollments.map((enr) => (
                    <div key={enr.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
                      <div className="aspect-video bg-zinc-100 border-b border-zinc-200 flex items-center justify-center relative">
                        {enr.course.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={enr.course.thumbnailUrl} alt={enr.course.title} className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="w-8 h-8 text-zinc-300" />
                        )}
                        {enr.status === 'COMPLETED' && (
                          <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1">
                            <Award className="w-3 h-3" /> Completed
                          </span>
                        )}
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-semibold text-zinc-950 mb-1">{enr.course.title}</h3>
                        <p className="text-xs text-zinc-500 line-clamp-2 mb-4">{enr.course.shortDescription}</p>
                        <div className="mt-auto">
                          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                            <span>Progress</span>
                            <span className="font-semibold text-zinc-900 tabular-nums">{Math.round(enr.progressPercent)}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full mb-4 overflow-hidden">
                            <div
                              className="h-1.5 bg-blue-600 rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, enr.progressPercent))}%` }}
                            />
                          </div>
                          <Link
                            href={`/learn/${enr.course.id}`}
                            className="flex items-center justify-center gap-1.5 w-full bg-zinc-950 text-white font-medium py-2 rounded-md hover:bg-zinc-800 transition-colors text-xs"
                          >
                            <Play className="w-3.5 h-3.5" /> Continue learning
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Payment History */}
            {tab === 'payments' && (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                {payments.length === 0 ? (
                  <div className="p-12 text-center text-sm text-zinc-500">No payment submissions found.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">UTR</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Amount</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Date</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-5 py-3.5 font-mono text-xs">{p.utrNumber}</td>
                          <td className="px-5 py-3.5 font-semibold tabular-nums">₹{(p.amountPaise / 100).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5 text-xs text-zinc-500 tabular-nums">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                              p.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.status === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Notifications */}
            {tab === 'notifications' && (
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center text-sm text-zinc-500">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`p-5 flex items-start justify-between gap-4 ${n.isRead ? '' : 'bg-blue-50/40'}`}>
                      <div>
                        <div className="font-semibold text-zinc-950 text-sm">{n.title}</div>
                        <div className="text-sm text-zinc-600 mt-1">{n.message}</div>
                        <div className="text-xs text-zinc-400 mt-1.5">{new Date(n.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-xs font-medium text-blue-700 hover:underline flex-shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Settings */}
            {tab === 'settings' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                  <h2 className="font-semibold text-zinc-950 text-sm mb-4">Profile Details</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-zinc-500">Student ID</span>
                      <span className="font-mono font-semibold text-zinc-950">{data.student.studentId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-zinc-500">Full Name</span>
                      <span className="font-medium text-zinc-950">{data.student.name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-zinc-500">Email</span>
                      <span className="text-zinc-900">{data.student.email}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500">Phone</span>
                      <span className="text-zinc-900 font-mono text-xs">+91 {data.student.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                  <h2 className="font-semibold text-zinc-950 text-sm mb-4">Change Password</h2>
                  {pwMsg && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md px-3 py-2 mb-4 text-xs">
                      <CheckCircle className="w-4 h-4" /> {pwMsg}
                    </div>
                  )}
                  {pwError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 mb-4 text-xs">
                      <AlertCircle className="w-4 h-4" /> {pwError}
                    </div>
                  )}
                  <form onSubmit={handleChangePassword} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">New Password (min 8 chars)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="w-full bg-zinc-950 text-white font-medium py-2 rounded-md hover:bg-zinc-800 disabled:opacity-50 text-sm"
                    >
                      {pwLoading ? 'Updating...' : 'Update password'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
