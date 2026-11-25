'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Globe, Archive, FileText, Loader2, AlertCircle, Video
} from 'lucide-react';

interface Resource {
  id: string;
  title: string;
  type: string;
  url?: string | null;
}

interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  isFreePreview: boolean;
  videoAsset?: { status: string } | null;
  resources: Resource[];
  quiz?: { id: string; title: string; isPublished: boolean } | null;
}

interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sections: Section[];
}

export default function AdminCourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, string>>({});
  const [resourceLessonId, setResourceLessonId] = useState<{ sectionId: string; lessonId: string } | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState('PDF');
  const [resUrl, setResUrl] = useState('');

  const loadCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
      const json = await res.json();
      if (json.success) setCourse(json.data);
      else setError(json.message || 'Course not found');
    } catch {
      setError('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourse(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: newSectionTitle }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    setNewSectionTitle('');
    loadCourse();
  };

  const deleteSection = async (sectionId: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${sectionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    loadCourse();
  };

  const addLesson = async (sectionId: string) => {
    const title = lessonDrafts[sectionId]?.trim();
    if (!title) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${sectionId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    setLessonDrafts((prev) => ({ ...prev, [sectionId]: '' }));
    loadCourse();
  };

  const deleteLesson = async (sectionId: string, lessonId: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${sectionId}/lessons/${lessonId}`,
      { method: 'DELETE', credentials: 'include' },
    );
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    loadCourse();
  };

  const addResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceLessonId) return;
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${resourceLessonId.sectionId}/lessons/${resourceLessonId.lessonId}/resources`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: resTitle, type: resType, url: resUrl }),
      },
    );
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    setResourceLessonId(null);
    setResTitle('');
    setResUrl('');
    loadCourse();
  };

  const deleteResource = async (sectionId: string, lessonId: string, resourceId: string) => {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${sectionId}/lessons/${lessonId}/resources/${resourceId}`,
      { method: 'DELETE', credentials: 'include' },
    );
    loadCourse();
  };

  const changeStatus = async (action: 'publish' | 'archive') => {
    setError('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    loadCourse();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 h-16 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/admin/courses" className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 truncate">{course?.title ?? 'Course Builder'}</h1>
        </div>
        {course && (
          <div className="flex items-center gap-2">
            <Link
              href="/admin/videos"
              className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              <Video className="w-3.5 h-3.5" /> Upload Videos
            </Link>
            {course.status !== 'PUBLISHED' ? (
              <button
                onClick={() => changeStatus('publish')}
                className="inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-700"
              >
                <Globe className="w-3.5 h-3.5" /> Publish
              </button>
            ) : (
              <button
                onClick={() => changeStatus('archive')}
                className="inline-flex items-center gap-1.5 bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-800"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
            <button onClick={() => setError('')} className="ml-auto">✕</button>
          </div>
        )}

        {/* Add Section */}
        <form onSubmit={addSection} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
          <input
            type="text"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="New section title (e.g. Module 1: Fundamentals)"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </form>

        {/* Sections List */}
        {course?.sections.map((section) => (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
              <span className="font-semibold text-gray-900 text-sm">{section.title}</span>
              <button
                onClick={() => deleteSection(section.id)}
                className="text-gray-400 hover:text-red-600"
                title="Delete section"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {section.lessons.map((lesson) => (
                <div key={lesson.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium text-gray-900">{lesson.title}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        lesson.videoAsset?.status === 'READY'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {lesson.videoAsset?.status ?? 'NO VIDEO'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/quizzes/${lesson.id}`}
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline font-medium"
                      >
                        {lesson.quiz ? 'Edit Quiz' : '+ Quiz'}
                      </Link>
                      <button
                        onClick={() => setResourceLessonId({ sectionId: section.id, lessonId: lesson.id })}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" /> + Resource
                      </button>
                      <button
                        onClick={() => deleteLesson(section.id, lesson.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {lesson.resources.length > 0 && (
                    <div className="mt-2 pl-4 space-y-1">
                      {lesson.resources.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs text-gray-500">
                          <FileText className="w-3 h-3 text-brand-500" />
                          <span>{r.title} ({r.type})</span>
                          <button
                            onClick={() => deleteResource(section.id, lesson.id, r.id)}
                            className="text-red-400 hover:text-red-600 ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Lesson to Section */}
            <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={lessonDrafts[section.id] ?? ''}
                onChange={(e) => setLessonDrafts((prev) => ({ ...prev, [section.id]: e.target.value }))}
                placeholder="New lesson title..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
              />
              <button
                onClick={() => addLesson(section.id)}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                <Plus className="w-3.5 h-3.5" /> Add Lesson
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Resource Modal */}
      {resourceLessonId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-900">Attach PDF / Resource</h2>
              <button onClick={() => setResourceLessonId(null)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={addResource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="e.g. Lecture Slides PDF"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                >
                  <option value="PDF">PDF</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="LINK">Link</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Resource URL *</label>
                <input
                  type="url"
                  required
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <button type="submit" className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-xl text-sm">
                Attach Resource
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
