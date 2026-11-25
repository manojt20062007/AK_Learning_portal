'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, ArrowUpRight } from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';

interface DashboardData {
  students: { total: number; active: number };
  courses: { total: number; published: number };
  enrollments: { active: number };
  payments: { pending: number };
  recentStudents: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    studentProfile?: { studentId: string } | null;
  }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/dashboard`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError(json.message || 'Failed to load dashboard');
      })
      .catch(() => setError('Could not connect to server'))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AdminShell
      title="Overview"
      actions={
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-1.5 bg-zinc-950 text-white text-xs font-medium px-3.5 py-2 rounded-md hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New course
        </Link>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Students', value: data.students.total, sub: `${data.students.active} active`, href: '/admin/students' },
              { label: 'Published Courses', value: data.courses.published, sub: `${data.courses.total} total`, href: '/admin/courses' },
              { label: 'Active Enrollments', value: data.enrollments.active, sub: 'Currently enrolled', href: '/admin/students' },
              {
                label: 'Pending Payments',
                value: data.payments.pending,
                sub: data.payments.pending > 0 ? 'Awaiting verification' : 'All caught up',
                href: '/admin/payments',
                highlight: data.payments.pending > 0,
              },
            ].map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-400 transition-colors group"
              >
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                  <span>{stat.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                </div>
                <div className={`text-2xl font-bold mt-2 tabular-nums ${stat.highlight ? 'text-amber-600' : 'text-zinc-950'}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{stat.sub}</div>
              </Link>
            ))}
          </div>

          {/* Recent Students */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-950">Recent Students</h2>
              <Link href="/admin/students" className="text-xs font-medium text-blue-700 hover:underline">
                View all →
              </Link>
            </div>
            {data.recentStudents.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No students yet. Create a student or approve a payment to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-zinc-500">Student</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-zinc-500">Student ID</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-zinc-500">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.recentStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-zinc-50/70">
                      <td className="px-5 py-3">
                        <div className="font-medium text-zinc-950">{student.name}</div>
                        <div className="text-xs text-zinc-500">{student.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        {student.studentProfile?.studentId ? (
                          <span className="font-mono text-xs bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded">
                            {student.studentProfile.studentId}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-zinc-500 tabular-nums">
                        {new Date(student.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
