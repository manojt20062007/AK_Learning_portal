'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, Globe, Archive, Trash2, Loader2, AlertCircle } from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  level: string;
  pricePaise: number;
  enrollmentCount: number;
  category?: { name: string } | null;
  _count?: { sections: number; enrollments: number };
}

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
      const json = await res.json();
      if (json.success) setCourses(json.data);
      else setError(json.message);
    } catch {
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const action = async (id: string, type: 'publish' | 'archive' | 'draft') => {
    setError('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/${type}`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.success) { setError(json.message || 'Action failed'); return; }
    loadCourses();
  };

  const remove = async (id: string) => {
    setError('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.success) { setError(json.message || 'Delete failed'); return; }
    loadCourses();
  };

  return (
    <AdminShell
      title="Courses"
      actions={
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-1.5 bg-zinc-950 text-white text-xs font-medium px-3.5 py-2 rounded-md hover:bg-zinc-800"
        >
          <Plus className="w-3.5 h-3.5" /> New course
        </Link>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm mb-4">No courses yet. Create your first course.</p>
          <Link href="/admin/courses/new" className="inline-flex items-center gap-1.5 bg-zinc-950 text-white text-xs font-medium px-4 py-2 rounded-md">
            <Plus className="w-3.5 h-3.5" /> Create course
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Course</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Category</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Price</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Sections</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/70">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/courses/${c.id}`} className="font-medium text-zinc-950 hover:text-blue-700">
                      {c.title}
                    </Link>
                    <div className="text-xs text-zinc-400 font-mono">/{c.slug}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{c.category?.name ?? '—'}</td>
                  <td className="px-5 py-3.5 font-semibold tabular-nums">₹{(c.pricePaise / 100).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600 tabular-nums">{c._count?.sections ?? 0}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                      c.status === 'PUBLISHED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : c.status === 'ARCHIVED'
                        ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.status !== 'PUBLISHED' && (
                        <button
                          onClick={() => action(c.id, 'publish')}
                          title="Publish"
                          className="p-1.5 rounded-md border border-zinc-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {c.status === 'PUBLISHED' && (
                        <button
                          onClick={() => action(c.id, 'archive')}
                          title="Archive"
                          className="p-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {c.status === 'DRAFT' && (
                        <button
                          onClick={() => remove(c.id)}
                          title="Delete Draft"
                          className="p-1.5 rounded-md border border-zinc-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
