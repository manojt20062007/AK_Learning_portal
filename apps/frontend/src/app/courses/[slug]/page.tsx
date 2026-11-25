import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Clock, Users, BarChart2, BookOpen, CheckCircle, ChevronRight, ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  thumbnailUrl?: string;
  level: string;
  language: string;
  pricePaise: number;
  durationHours?: number;
  totalLessons: number;
  enrollmentCount: number;
  requirements: string[];
  whatYouLearn: string[];
  tags: string[];
  category?: { name: string; color?: string; slug: string };
  sections: Array<{
    id: string;
    title: string;
    order: number;
    lessons: Array<{
      id: string;
      title: string;
      order: number;
      isFreePreview: boolean;
      durationSeconds?: number;
    }>;
  }>;
}

async function getCourse(slug: string): Promise<Course | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/public/courses/${slug}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return { title: 'Course Not Found' };
  return {
    title: course.title,
    description: course.shortDescription,
  };
}

function formatPrice(paise: number) {
  if (paise === 0) return 'Free';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function LevelBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    BEGINNER: { label: 'Beginner', cls: 'bg-green-100 text-green-700' },
    INTERMEDIATE: { label: 'Intermediate', cls: 'bg-yellow-100 text-yellow-700' },
    ADVANCED: { label: 'Advanced', cls: 'bg-red-100 text-red-700' },
    ALL_LEVELS: { label: 'All Levels', cls: 'bg-blue-100 text-blue-700' },
  };
  const { label, cls } = map[level] ?? { label: level, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const totalLessons = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalDuration = course.sections.reduce(
    (acc, s) => acc + s.lessons.reduce((a, l) => a + (l.durationSeconds ?? 0), 0),
    0,
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950">
      <Navbar />
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-11 flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-950">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
          <Link href="/courses" className="hover:text-zinc-950">Courses</Link>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
          <span className="text-zinc-900 font-medium truncate max-w-xs">{course.title}</span>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Clean Editorial Course Header */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 mb-6">
              {course.category && (
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
                  {course.category.name}
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-950 mb-3 leading-tight tracking-tight">{course.title}</h1>
              <p className="text-zinc-600 text-base mb-5 leading-relaxed">{course.shortDescription}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-4 border-t border-zinc-100">
                <LevelBadge level={course.level} />
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Users className="w-4 h-4 text-zinc-400" /> {course.enrollmentCount.toLocaleString()} enrolled
                </span>
                {course.durationHours && (
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-4 h-4 text-zinc-400" /> {course.durationHours.toFixed(0)} hours
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-zinc-400" /> {course.language}
                </span>
              </div>
            </div>

            {/* What you'll learn */}
            {course.whatYouLearn.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">What you&apos;ll learn</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {course.whatYouLearn.map((item, i) => (
                    <div key={i} className="flex gap-2.5">
                      <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements */}
            {course.requirements.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Requirements</h2>
                <ul className="space-y-2">
                  {course.requirements.map((req, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-gray-400 mt-0.5">•</span> {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">About this course</h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {course.description}
              </div>
            </div>

            {/* Curriculum */}
            {course.sections.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Course Curriculum</h2>
                <p className="text-sm text-gray-500 mb-5">
                  {course.sections.length} sections · {totalLessons} lessons
                  {totalDuration > 0 && ` · ${formatDuration(totalDuration)} total`}
                </p>
                <div className="space-y-3">
                  {course.sections.map((section) => (
                    <div key={section.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 font-semibold text-sm text-gray-900 flex items-center justify-between">
                        <span>{section.title}</span>
                        <span className="text-xs text-gray-400">{section.lessons.length} lessons</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {section.lessons.map((lesson) => (
                          <div key={lesson.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                            {lesson.isFreePreview ? (
                              <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                                Preview
                              </span>
                            ) : (
                              <BookOpen className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            )}
                            <span className="flex-1 text-gray-700">{lesson.title}</span>
                            {lesson.durationSeconds && (
                              <span className="text-xs text-gray-400">{formatDuration(lesson.durationSeconds)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — Enrollment Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sticky top-24">
              {course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full aspect-video object-cover rounded-xl mb-5"
                />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-brand-100 to-purple-100 rounded-xl mb-5 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-brand-300" />
                </div>
              )}

              <div className="text-3xl font-bold text-gray-900 mb-1">
                {formatPrice(course.pricePaise)}
              </div>
              {course.pricePaise > 0 && (
                <p className="text-xs text-gray-500 mb-5">One-time payment · Lifetime access</p>
              )}

              <Link
                href={`/join/${course.id}`}
                className="flex items-center justify-center gap-2 w-full bg-brand-600 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-700 transition-colors mb-3"
              >
                Enroll Now <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="text-xs text-center text-gray-400 mb-5">Pay via UPI · Verified within 24h</p>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {course.durationHours ? `${course.durationHours.toFixed(0)}+ hours` : 'Self-paced'}
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  {totalLessons} lessons
                </div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-gray-400" />
                  {course.level.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400" />
                  Certificate of completion
                </div>
              </div>

              {course.tags.length > 0 && (
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1.5">
                    {course.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
