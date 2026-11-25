'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, Circle, FileText, Download, ChevronLeft,
  ChevronRight, Loader2, Award, BookOpen, AlertCircle, Video
} from 'lucide-react';
import ProtectedHlsPlayer from '@/components/video/ProtectedHlsPlayer';

interface ResourceItem {
  id: string;
  title: string;
  type: string;
  url?: string | null;
}

interface LessonItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  order: number;
  durationSeconds?: number | null;
  videoAsset?: { status: string; durationSeconds?: number | null } | null;
  resources: ResourceItem[];
  quiz?: { id: string; title: string; isPublished: boolean } | null;
  progress: {
    isCompleted: boolean;
    lastPosition: number;
    watchedSeconds: number;
  };
}

interface SectionItem {
  id: string;
  title: string;
  description?: string | null;
  lessons: LessonItem[];
}

interface LearnPayload {
  enrollment: {
    id: string;
    status: string;
    progressPercent: number;
    completedAt?: string | null;
  };
  course: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    sections: SectionItem[];
  };
}

export default function CourseLearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<LearnPayload | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const loadCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/courses/${courseId}/learn`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Unable to load course');
        return;
      }
      setData(json.data);
      const allLessons: LessonItem[] = json.data.course.sections.flatMap((s: SectionItem) => s.lessons);
      if (!activeLessonId && allLessons.length > 0) {
        const firstIncomplete = allLessons.find((l) => !l.progress.isCompleted);
        setActiveLessonId((firstIncomplete ?? allLessons[0]).id);
      }
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flatLessons = useMemo(() => {
    if (!data) return [];
    return data.course.sections.flatMap((s) => s.lessons);
  }, [data]);

  const activeIndex = flatLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = activeIndex >= 0 ? flatLessons[activeIndex] : null;
  const prevLesson = activeIndex > 0 ? flatLessons[activeIndex - 1] : null;
  const nextLesson = activeIndex >= 0 && activeIndex < flatLessons.length - 1 ? flatLessons[activeIndex + 1] : null;

  const toggleComplete = async (lesson: LessonItem, nextState?: boolean) => {
    const completed = nextState ?? !lesson.progress.isCompleted;
    setToggling(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/lessons/${lesson.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed }),
      });
      if (res.ok) {
        await loadCourse();
      }
    } finally {
      setToggling(false);
    }
  };

  const downloadResource = async (resourceId: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/resources/${resourceId}/download`, {
      credentials: 'include',
    });
    const json = await res.json();
    if (json.success && json.data?.downloadUrl) {
      window.open(json.data.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const claimCertificate = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/courses/${courseId}/certificate`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (json.success && json.data?.verificationCode) {
      router.push(`/verify/${json.data.verificationCode}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <p className="text-gray-800 font-medium mb-4">{error || 'Course not found'}</p>
        <Link href="/dashboard" className="text-brand-600 font-semibold text-sm hover:underline">
          ← Back to My Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-gray-900 text-white h-14 px-4 flex items-center justify-between border-b border-gray-800 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-gray-300 hover:text-white flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold text-sm truncate">{data.course.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-300">
            <div className="w-28 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-2 bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.round(data.enrollment.progressPercent)}%` }}
              />
            </div>
            <span className="font-semibold text-white">{Math.round(data.enrollment.progressPercent)}%</span>
          </div>
          {data.enrollment.status === 'COMPLETED' && (
            <button
              onClick={claimCertificate}
              className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            >
              <Award className="w-3.5 h-3.5" /> View Certificate
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-12">
        {/* Main Player & Lesson Content */}
        <main className="lg:col-span-8 xl:col-span-9 p-4 md:p-6 space-y-6">
          {!activeLesson ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">This course does not have any lessons yet.</p>
            </div>
          ) : (
            <>
              {/* Video Player */}
              {activeLesson.videoAsset?.status === 'READY' ? (
                <ProtectedHlsPlayer
                  key={activeLesson.id}
                  lessonId={activeLesson.id}
                  initialPosition={activeLesson.progress.lastPosition}
                  onEnded={() => {
                    if (!activeLesson.progress.isCompleted) {
                      toggleComplete(activeLesson, true);
                    }
                  }}
                />
              ) : (
                <div className="relative w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center text-gray-300 p-6 text-center">
                  {activeLesson.thumbnailUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={activeLesson.thumbnailUrl}
                      alt={activeLesson.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center">
                    <Video className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm font-medium">
                      {activeLesson.videoAsset?.status === 'PROCESSING'
                        ? 'Video is currently processing. Please check back shortly.'
                        : 'No video uploaded for this lesson yet.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Lesson Title + Complete Toggle + Navigation */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{activeLesson.title}</h1>
                    {activeLesson.durationSeconds && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Duration: {Math.floor(activeLesson.durationSeconds / 60)}m {activeLesson.durationSeconds % 60}s
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleComplete(activeLesson)}
                    disabled={toggling}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      activeLesson.progress.isCompleted
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {activeLesson.progress.isCompleted ? (
                      <><CheckCircle className="w-4 h-4" /> Completed</>
                    ) : (
                      <><Circle className="w-4 h-4" /> Mark as Complete</>
                    )}
                  </button>
                </div>

                {activeLesson.description && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-5">
                    {activeLesson.description}
                  </p>
                )}

                {/* Resources / PDFs */}
                {activeLesson.resources.length > 0 && (
                  <div className="pt-4 border-t border-gray-100 mb-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-3">PDFs & Resources</h2>
                    <div className="space-y-2">
                      {activeLesson.resources.map((res) => (
                        <button
                          key={res.id}
                          onClick={() => downloadResource(res.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 text-left text-sm transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-brand-600" />
                            <span className="font-medium text-gray-800">{res.title}</span>
                            <span className="text-[11px] uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              {res.type}
                            </span>
                          </div>
                          <Download className="w-4 h-4 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quiz link if published */}
                {activeLesson.quiz?.isPublished && (
                  <div className="pt-4 border-t border-gray-100 mb-5">
                    <Link
                      href={`/learn/${courseId}/quiz/${activeLesson.quiz.id}`}
                      className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-100 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-100"
                    >
                      Take Lesson Quiz: {activeLesson.quiz.title} →
                    </Link>
                  </div>
                )}

                {/* Prev / Next */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={() => prevLesson && setActiveLessonId(prevLesson.id)}
                    disabled={!prevLesson}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous Lesson
                  </button>
                  <button
                    onClick={() => nextLesson && setActiveLessonId(nextLesson.id)}
                    disabled={!nextLesson}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40"
                  >
                    Next Lesson <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Curriculum Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border-l border-gray-200 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Course Content</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {flatLessons.filter((l) => l.progress.isCompleted).length} / {flatLessons.length} lessons completed
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {data.course.sections.map((section) => (
              <div key={section.id}>
                <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {section.title}
                </div>
                <div>
                  {section.lessons.map((lesson) => {
                    const isActive = lesson.id === activeLessonId;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLessonId(lesson.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-2.5 text-sm transition-colors ${
                          isActive ? 'bg-brand-50 text-brand-800 font-medium' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {lesson.progress.isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                        )}
                        {lesson.thumbnailUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={lesson.thumbnailUrl}
                            alt={lesson.title}
                            className="w-12 h-8 rounded object-cover flex-shrink-0 bg-gray-100 border border-gray-200"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{lesson.title}</div>
                          {lesson.durationSeconds && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {Math.floor(lesson.durationSeconds / 60)}m {lesson.durationSeconds % 60}s
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
