'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Globe,
  Archive,
  FileText,
  AlertCircle,
  Video,
  Image as ImageIcon,
  Check,
  BookOpen,
  Layers,
  PlayCircle,
  HelpCircle,
} from 'lucide-react';
import BrandLoader from '@/components/layout/BrandLoader';

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
  thumbnailUrl?: string | null;
  isFreePreview: boolean;
  durationSeconds?: number | null;
  videoAsset?: { status: string; provider?: string; originalKey?: string | null } | null;
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
  shortDescription?: string;
  thumbnailUrl?: string | null;
  level?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sections: Section[];
  _count?: { enrollments: number; reviews: number };
}

export default function AdminCourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Course cover photo state
  const [courseCoverUrl, setCourseCoverUrl] = useState('');
  const [savingCourseCover, setSavingCourseCover] = useState(false);

  // Section & lesson drafts
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, string>>({});

  // Resource modal state
  const [resourceLessonId, setResourceLessonId] = useState<{ sectionId: string; lessonId: string } | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState('PDF');
  const [resUrl, setResUrl] = useState('');

  // Vimeo link modal state
  const [vimeoLesson, setVimeoLesson] = useState<Lesson | null>(null);
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [vimeoMinutes, setVimeoMinutes] = useState('');
  const [savingVimeo, setSavingVimeo] = useState(false);

  // Lesson cover modal state
  const [coverTarget, setCoverTarget] = useState<{ sectionId: string; lesson: Lesson } | null>(null);
  const [lessonCoverUrl, setLessonCoverUrl] = useState('');
  const [savingLessonCover, setSavingLessonCover] = useState(false);

  const loadCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setCourse(json.data);
        setCourseCoverUrl(json.data.thumbnailUrl ?? '');
      } else {
        setError(json.message || 'Course not found');
      }
    } catch {
      setError('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const sections = course?.sections ?? [];
    const totalLessons = sections.reduce((sum, s) => sum + s.lessons.length, 0);
    const videosReady = sections.reduce(
      (sum, s) => sum + s.lessons.filter((l) => l.videoAsset?.status === 'READY').length,
      0,
    );
    const coveredLessons = sections.reduce(
      (sum, s) => sum + s.lessons.filter((l) => Boolean(l.thumbnailUrl)).length,
      0,
    );
    return {
      sectionsCount: sections.length,
      totalLessons,
      videosReady,
      coveredLessons,
    };
  }, [course]);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const saveCourseCover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavingCourseCover(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ thumbnailUrl: courseCoverUrl.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to update course cover photo');
        return;
      }
      flashNotice('Course cover photo updated.');
      loadCourse();
    } finally {
      setSavingCourseCover(false);
    }
  };

  const saveLessonCover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverTarget) return;
    setError('');
    setSavingLessonCover(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${coverTarget.sectionId}/lessons/${coverTarget.lesson.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ thumbnailUrl: lessonCoverUrl.trim() || null }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to update lesson cover photo');
        return;
      }
      setCoverTarget(null);
      setLessonCoverUrl('');
      flashNotice('Lesson cover photo updated.');
      loadCourse();
    } finally {
      setSavingLessonCover(false);
    }
  };

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
    if (!res.ok) {
      setError(json.message);
      return;
    }
    setNewSectionTitle('');
    loadCourse();
  };

  const deleteSection = async (sectionId: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${sectionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message);
      return;
    }
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
    if (!res.ok) {
      setError(json.message);
      return;
    }
    setLessonDrafts((prev) => ({ ...prev, [sectionId]: '' }));
    loadCourse();
  };

  const deleteLesson = async (sectionId: string, lessonId: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/sections/${sectionId}/lessons/${lessonId}`,
      { method: 'DELETE', credentials: 'include' },
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.message);
      return;
    }
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
    if (!res.ok) {
      setError(json.message);
      return;
    }
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

  const saveVimeoLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vimeoLesson) return;
    setError('');
    setSavingVimeo(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/videos/lessons/${vimeoLesson.id}/vimeo`,
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
      setVimeoLesson(null);
      setVimeoUrl('');
      setVimeoMinutes('');
      loadCourse();
    } finally {
      setSavingVimeo(false);
    }
  };

  const changeStatus = async (action: 'publish' | 'archive') => {
    setError('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message);
      return;
    }
    loadCourse();
  };

  if (loading) {
    return <BrandLoader label="Loading course builder..." />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950">
      {/* Top Bar */}
      <header className="bg-white border-b border-zinc-200 px-6 h-16 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/courses"
            className="p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
            title="Back to Courses"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 truncate">
                {course?.title ?? 'Course Builder'}
              </h1>
              {course && (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    course.status === 'PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : course.status === 'ARCHIVED'
                        ? 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {course.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {course && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/admin/videos"
              className="inline-flex items-center gap-1.5 border border-zinc-200 bg-white text-zinc-700 text-xs font-medium px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <Video className="w-3.5 h-3.5" /> Video Library
            </Link>
            {course.status !== 'PUBLISHED' ? (
              <button
                onClick={() => changeStatus('publish')}
                className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" /> Publish Course
              </button>
            ) : (
              <button
                onClick={() => changeStatus('archive')}
                className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        )}

        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Course Cover Photo & Overview */}
          <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-22">
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              {/* 16:9 Course Cover Preview */}
              <div className="aspect-video bg-zinc-950 relative overflow-hidden">
                {course?.thumbnailUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 text-center">
                    <ImageIcon className="w-8 h-8 mb-2 text-zinc-500" />
                    <p className="text-xs font-medium text-zinc-300">No Course Cover Photo</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Add a 16:9 cover image URL below</p>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950">Course Cover Photo</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Displayed on the catalog, student dashboard, and course overview.
                  </p>
                </div>

                <form onSubmit={saveCourseCover} className="space-y-2.5">
                  <input
                    type="url"
                    value={courseCoverUrl}
                    onChange={(e) => setCourseCoverUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingCourseCover}
                      className="flex-1 bg-zinc-950 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                    >
                      {savingCourseCover ? 'Saving...' : 'Save Course Cover'}
                    </button>
                    {course?.thumbnailUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          setCourseCoverUrl('');
                          setSavingCourseCover(true);
                          try {
                            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ thumbnailUrl: null }),
                            });
                            flashNotice('Course cover removed.');
                            loadCourse();
                          } finally {
                            setSavingCourseCover(false);
                          }
                        }}
                        className="px-3 py-2 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </form>

                {/* Quick Course Stats */}
                <div className="pt-4 border-t border-zinc-100 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
                    <div className="flex items-center justify-center gap-1 text-zinc-400 mb-0.5">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-base font-bold text-zinc-950">{stats.sectionsCount}</div>
                    <div className="text-[11px] text-zinc-500">Sections</div>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
                    <div className="flex items-center justify-center gap-1 text-zinc-400 mb-0.5">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-base font-bold text-zinc-950">{stats.totalLessons}</div>
                    <div className="text-[11px] text-zinc-500">Lessons</div>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
                    <div className="flex items-center justify-center gap-1 text-zinc-400 mb-0.5">
                      <PlayCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-base font-bold text-zinc-950">{stats.videosReady}</div>
                    <div className="text-[11px] text-zinc-500">Videos</div>
                  </div>
                </div>

                {course?.shortDescription && (
                  <p className="text-xs text-zinc-500 leading-relaxed pt-1 border-t border-zinc-100">
                    {course.shortDescription}
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Right Column: Curriculum Builder */}
          <main className="lg:col-span-8 space-y-5">
            {/* Add Section Bar */}
            <form
              onSubmit={addSection}
              className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col sm:flex-row gap-3 shadow-xs"
            >
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="New section title (e.g. Module 1: Fundamentals)"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 bg-zinc-950 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Section
              </button>
            </form>

            {/* Empty State */}
            {course && course.sections.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
                <Layers className="w-8 h-8 text-zinc-300 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-zinc-900">No sections yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Create your first module above to start adding lessons, cover photos, and Vimeo videos.
                </p>
              </div>
            )}

            {/* Sections List */}
            {course?.sections.map((section, sectionIdx) => (
              <div
                key={section.id}
                className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs"
              >
                <div className="bg-zinc-50 px-5 py-3.5 flex items-center justify-between border-b border-zinc-200">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono font-semibold text-zinc-500 bg-white border border-zinc-200 px-2 py-0.5 rounded-md">
                      0{sectionIdx + 1}
                    </span>
                    <span className="font-semibold text-zinc-950 text-sm">{section.title}</span>
                    <span className="text-xs text-zinc-400">
                      ({section.lessons.length} {section.lessons.length === 1 ? 'lesson' : 'lessons'})
                    </span>
                  </div>
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="divide-y divide-zinc-100">
                  {section.lessons.length === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-zinc-400">
                      No lessons in this section yet. Add one below.
                    </div>
                  ) : (
                    section.lessons.map((lesson, lessonIdx) => (
                      <div key={lesson.id} className="px-5 py-4 hover:bg-zinc-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Lesson Cover Thumbnail */}
                            <button
                              type="button"
                              onClick={() => {
                                setCoverTarget({ sectionId: section.id, lesson });
                                setLessonCoverUrl(lesson.thumbnailUrl ?? '');
                              }}
                              className="group relative w-24 h-14 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-900 flex-shrink-0 flex items-center justify-center"
                              title="Set lesson cover photo"
                            >
                              {lesson.thumbnailUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={lesson.thumbnailUrl}
                                  alt={lesson.title}
                                  className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                                  <ImageIcon className="w-4 h-4" />
                                  <span className="text-[9px] mt-0.5 font-medium">Cover</span>
                                </div>
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-zinc-400">
                                  {sectionIdx + 1}.{lessonIdx + 1}
                                </span>
                                <span className="text-sm font-semibold text-zinc-950 truncate">
                                  {lesson.title}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    lesson.videoAsset?.status === 'READY'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                                  }`}
                                >
                                  {lesson.videoAsset?.status ?? 'NO VIDEO'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                {lesson.durationSeconds ? (
                                  <span>{Math.round(lesson.durationSeconds / 60)} min</span>
                                ) : (
                                  <span>Duration unset</span>
                                )}
                                {lesson.resources.length > 0 && (
                                  <span>• {lesson.resources.length} resource(s)</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Lesson Actions */}
                          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap flex-shrink-0">
                            <button
                              onClick={() => {
                                setCoverTarget({ sectionId: section.id, lesson });
                                setLessonCoverUrl(lesson.thumbnailUrl ?? '');
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              {lesson.thumbnailUrl ? 'Cover' : '+ Cover'}
                            </button>
                            <button
                              onClick={() => {
                                setVimeoLesson(lesson);
                                setVimeoUrl(lesson.videoAsset?.originalKey ?? '');
                                setVimeoMinutes(
                                  lesson.durationSeconds ? String(Math.round(lesson.durationSeconds / 60)) : '',
                                );
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              {lesson.videoAsset?.status === 'READY' ? 'Edit Video' : '+ Vimeo'}
                            </button>
                            <Link
                              href={`/admin/quizzes/${lesson.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              {lesson.quiz ? 'Quiz' : '+ Quiz'}
                            </Link>
                            <button
                              onClick={() => setResourceLessonId({ sectionId: section.id, lessonId: lesson.id })}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> + Resource
                            </button>
                            <button
                              onClick={() => deleteLesson(section.id, lesson.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete lesson"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {lesson.resources.length > 0 && (
                          <div className="mt-3 pl-28 space-y-1">
                            {lesson.resources.map((r) => (
                              <div key={r.id} className="flex items-center gap-2 text-xs text-zinc-500">
                                <FileText className="w-3 h-3 text-zinc-400" />
                                <span>
                                  {r.title} ({r.type})
                                </span>
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
                    ))
                  )}
                </div>

                {/* Add Lesson to Section */}
                <div className="p-4 bg-zinc-50/70 border-t border-zinc-200 flex gap-2.5">
                  <input
                    type="text"
                    value={lessonDrafts[section.id] ?? ''}
                    onChange={(e) => setLessonDrafts((prev) => ({ ...prev, [section.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLesson(section.id);
                      }
                    }}
                    placeholder="New lesson title..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    onClick={() => addLesson(section.id)}
                    className="inline-flex items-center gap-1 bg-white border border-zinc-300 text-zinc-800 text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-zinc-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Lesson
                  </button>
                </div>
              </div>
            ))}
          </main>
        </div>
      </div>

      {/* Lesson Cover Photo Modal */}
      {coverTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-zinc-950 text-base">Lesson Cover Photo</h2>
              <button onClick={() => setCoverTarget(null)} className="text-zinc-400 hover:text-zinc-700">
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Lesson: <strong>{coverTarget.lesson.title}</strong>
            </p>

            <div className="aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 mb-4 flex items-center justify-center">
              {lessonCoverUrl.trim() ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={lessonCoverUrl.trim()} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-zinc-400">
                  <ImageIcon className="w-7 h-7 mx-auto mb-1" />
                  <p className="text-xs">16:9 Cover Preview</p>
                </div>
              )}
            </div>

            <form onSubmit={saveLessonCover} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={lessonCoverUrl}
                  onChange={(e) => setLessonCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingLessonCover}
                  className="flex-1 bg-zinc-950 text-white font-semibold py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm"
                >
                  {savingLessonCover ? 'Saving...' : 'Save Cover'}
                </button>
                {coverTarget.lesson.thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => setLessonCoverUrl('')}
                    className="px-4 py-2.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vimeo Video Link Modal */}
      {vimeoLesson && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-zinc-950 text-base">Link Vimeo Video</h2>
              <button onClick={() => setVimeoLesson(null)} className="text-zinc-400 hover:text-zinc-700">
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Lesson: <strong>{vimeoLesson.title}</strong>
            </p>
            <form onSubmit={saveVimeoLink} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Vimeo Video URL or ID *</label>
                <input
                  type="text"
                  required
                  value={vimeoUrl}
                  onChange={(e) => setVimeoUrl(e.target.value)}
                  placeholder="https://vimeo.com/123456789"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Supports standard links, unlisted links (with hash), or numeric video IDs.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Duration (minutes, optional)</label>
                <input
                  type="number"
                  min={1}
                  value={vimeoMinutes}
                  onChange={(e) => setVimeoMinutes(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={savingVimeo}
                className="w-full bg-zinc-950 text-white font-semibold py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm"
              >
                {savingVimeo ? 'Saving...' : 'Save Vimeo Link'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {resourceLessonId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-zinc-950">Attach PDF / Resource</h2>
              <button onClick={() => setResourceLessonId(null)} className="text-zinc-400 hover:text-zinc-700">
                ✕
              </button>
            </div>
            <form onSubmit={addResource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="e.g. Lecture Slides PDF"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Type</label>
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm bg-white"
                >
                  <option value="PDF">PDF</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="LINK">Link</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Resource URL *</label>
                <input
                  type="url"
                  required
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-zinc-950 text-white font-semibold py-2.5 rounded-lg hover:bg-zinc-800 text-sm"
              >
                Attach Resource
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
