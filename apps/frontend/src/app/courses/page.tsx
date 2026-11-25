import Link from 'next/link';
import { BookOpen, Clock, BarChart2, ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

async function getCourses(category?: string) {
  try {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/public/courses${qs}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { data: [], meta: { total: 0 } };
    return res.json();
  } catch {
    return { data: [], meta: { total: 0 } };
  }
}

async function getCategories() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/public/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { data: [] };
    return res.json();
  } catch {
    return { data: [] };
  }
}

function formatPrice(paise: number) {
  if (paise === 0) return 'Free';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [coursesData, categoriesData] = await Promise.all([
    getCourses(category),
    getCategories(),
  ]);
  const courses = coursesData.data ?? [];
  const categories = categoriesData.data ?? [];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950">
      <Navbar />

      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Course Catalog</h1>
          <p className="text-sm text-zinc-600 mt-1 tabular-nums">
            {coursesData.meta?.total ?? courses.length} published courses
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 flex-shrink-0">
            <div className="bg-white border border-zinc-200 rounded-xl p-4 sticky top-24">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 px-2">
                Categories
              </h2>
              <div className="space-y-0.5">
                <Link
                  href="/courses"
                  className={`flex items-center justify-between px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    !category ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <span>All Courses</span>
                </Link>
                {categories.map((cat: { slug: string; name: string; _count?: { courses: number } }) => (
                  <Link
                    key={cat.slug}
                    href={`/courses?category=${cat.slug}`}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-colors ${
                      category === cat.slug
                        ? 'bg-zinc-950 text-white font-medium'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-xs opacity-60 tabular-nums">{cat._count?.courses ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-1">
            {courses.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl py-20 px-6 text-center">
                <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-zinc-900 mb-1">No courses found</h3>
                <p className="text-sm text-zinc-500">
                  {category ? 'No published courses in this category yet.' : 'Courses will appear here once published.'}
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {courses.map((course: {
                  id: string;
                  slug: string;
                  title: string;
                  shortDescription: string;
                  thumbnailUrl?: string;
                  level: string;
                  durationHours?: number;
                  totalLessons: number;
                  pricePaise: number;
                  category?: { name: string };
                }) => (
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
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                        <span className="font-medium text-blue-700">{course.category?.name ?? 'Course'}</span>
                        <span className="flex items-center gap-1 capitalize">
                          <BarChart2 className="w-3 h-3" />
                          {course.level.replace('_', ' ').toLowerCase()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-zinc-950 mb-1.5 line-clamp-2 group-hover:text-blue-700 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-sm text-zinc-600 line-clamp-2 mb-4 flex-1">
                        {course.shortDescription}
                      </p>
                      <div className="flex items-center justify-between pt-3.5 border-t border-zinc-100">
                        <span className="text-base font-bold text-zinc-950 tabular-nums">
                          {formatPrice(course.pricePaise)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 group-hover:text-zinc-950">
                          {course.durationHours ? (
                            <span className="flex items-center gap-1 mr-2 tabular-nums">
                              <Clock className="w-3.5 h-3.5" /> {course.durationHours}h
                            </span>
                          ) : null}
                          Details <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
