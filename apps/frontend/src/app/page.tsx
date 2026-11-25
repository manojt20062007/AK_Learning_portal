import Link from 'next/link';
import { ArrowRight, Check, BookOpen, Clock, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

interface CourseCard {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  thumbnailUrl?: string | null;
  level: string;
  pricePaise: number;
  durationHours?: number | null;
  totalLessons: number;
  category?: { name: string } | null;
}

async function getFeaturedCourses(): Promise<CourseCard[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/public/courses?limit=6`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

function formatPrice(paise: number) {
  if (paise === 0) return 'Free';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default async function HomePage() {
  const courses = await getFeaturedCourses();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950 flex flex-col">
      <Navbar />

      {/* Editorial Hero */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16 md:py-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 border border-zinc-200 bg-zinc-50 rounded-full px-3 py-1 text-xs font-medium text-zinc-700 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                Self-paced 1080p curriculum · Direct UPI enrollment
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-950 leading-[1.1] mb-5">
                Structured technical courses built for deep understanding.
              </h1>
              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed mb-8 max-w-xl">
                Learn with step-by-step HD lessons, downloadable study resources, graded quizzes,
                and verifiable completion certificates—without subscription lock-in.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 bg-zinc-950 text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-zinc-800 transition-colors"
                >
                  Explore courses <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-white border border-zinc-300 text-zinc-800 text-sm font-medium px-5 py-2.5 rounded-md hover:bg-zinc-50 transition-colors"
                >
                  Student sign in
                </Link>
              </div>
            </div>

            {/* Clean Enrollment Summary Card (No fake metrics) */}
            <div className="lg:col-span-5">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      How Enrollment Works
                    </div>
                    <div className="text-sm font-semibold text-zinc-950 mt-0.5">
                      Transparent 3-step access
                    </div>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-blue-700" />
                </div>

                <ol className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-xs font-mono font-semibold flex items-center justify-center flex-shrink-0 text-zinc-900">
                      01
                    </span>
                    <div>
                      <div className="font-medium text-zinc-900">Pick a course &amp; submit details</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Enter your name, email, and mobile number on the course page.
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-xs font-mono font-semibold flex items-center justify-center flex-shrink-0 text-zinc-900">
                      02
                    </span>
                    <div>
                      <div className="font-medium text-zinc-900">Pay via Google Pay, PhonePe, or UPI</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Scan the UPI QR code and submit your UTR reference number.
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-xs font-mono font-semibold flex items-center justify-center flex-shrink-0 text-zinc-900">
                      03
                    </span>
                    <div>
                      <div className="font-medium text-zinc-900">Receive your Student ID &amp; invite</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Once verified, set your password via email or WhatsApp and start learning.
                      </div>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real Published Courses */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16 w-full flex-1">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950">Available Courses</h2>
            <p className="text-sm text-zinc-600 mt-1">
              One-time enrollment fee with lifetime access to lessons and updates.
            </p>
          </div>
          <Link
            href="/courses"
            className="text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
          >
            View catalog →
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
            <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-800">Catalog is being prepared</p>
            <p className="text-xs text-zinc-500 mt-1">
              Published courses will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="group bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 transition-colors flex flex-col"
              >
                <div className="aspect-video bg-zinc-100 border-b border-zinc-200 relative overflow-hidden">
                  {course.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 mb-2">
                    <span className="font-medium text-blue-700">
                      {course.category?.name ?? 'Course'}
                    </span>
                    <span className="capitalize">{course.level.replace('_', ' ').toLowerCase()}</span>
                  </div>
                  <h3 className="font-semibold text-zinc-950 text-base leading-snug mb-2 group-hover:text-blue-700 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-zinc-600 line-clamp-2 mb-4 flex-1">
                    {course.shortDescription}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-100 text-sm">
                    <span className="font-bold text-zinc-950 tabular-nums">
                      {formatPrice(course.pricePaise)}
                    </span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {course.durationHours ? `${course.durationHours}h` : `${course.totalLessons} lessons`}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Included with every enrollment */}
        <div className="mt-16 bg-white border border-zinc-200 rounded-xl p-6 sm:p-8">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: '1080p Protected Streaming',
                desc: 'Adaptive HLS playback with resume position across desktop and mobile.',
              },
              {
                title: 'Resources & Quizzes',
                desc: 'Downloadable PDFs, reference sheets, and lesson quizzes with instant scoring.',
              },
              {
                title: 'Verified Certificates',
                desc: 'Unique Student ID and publicly verifiable completion certificate.',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-950">{item.title}</div>
                  <div className="text-xs text-zinc-600 mt-1 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-zinc-200 py-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="font-medium text-zinc-700">
            © {new Date().getFullYear()} AK Learning
          </div>
          <div className="flex items-center gap-6">
            <Link href="/courses" className="hover:text-zinc-900">Courses</Link>
            <Link href="/login" className="hover:text-zinc-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
