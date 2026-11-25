'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Image as ImageIcon, Clock, Tag } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

const LEVEL_LABELS: Record<string, string> = {
  ALL_LEVELS: 'All Levels',
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export default function NewCoursePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('ALL_LEVELS');
  const [priceInr, setPriceInr] = useState('499');
  const [durationHours, setDurationHours] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/categories`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.push('/login');
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (json?.success && json.data.length > 0) {
          setCategories(json.data);
          setCategoryId(json.data[0].id);
        }
      })
      .catch(() => {});
  }, [router]);

  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name ?? 'Course';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          shortDescription,
          description,
          categoryId,
          level,
          thumbnailUrl: thumbnailUrl.trim() || null,
          pricePaise: Math.round(parseFloat(priceInr || '0') * 100),
          durationHours: durationHours ? parseFloat(durationHours) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to create course');
        return;
      }
      router.push(json.data?.id ? `/admin/courses/${json.data.id}` : '/admin/courses');
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950">
      {/* Top Bar */}
      <header className="bg-white border-b border-zinc-200 px-6 h-16 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/courses"
            className="p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
            title="Back to Courses"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950">
            Create New Course
          </h1>
        </div>
        <Link
          href="/admin/courses"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-950 transition-colors"
        >
          Cancel
        </Link>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Cover Photo & Live Card Preview */}
          <aside className="lg:col-span-5 space-y-5 lg:sticky lg:top-22">
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Live Course Card Preview
                </span>
                <span className="text-[11px] font-medium text-zinc-400">16:9 Cover</span>
              </div>

              {/* Cover Preview */}
              <div className="aspect-video bg-zinc-950 relative overflow-hidden">
                {thumbnailUrl.trim() ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbnailUrl.trim()}
                    alt={title || 'Course cover preview'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 text-center">
                    <ImageIcon className="w-9 h-9 mb-2 text-zinc-500" />
                    <p className="text-xs font-medium text-zinc-300">Course Cover Preview</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Paste a cover image URL below to preview it here
                    </p>
                  </div>
                )}
              </div>

              {/* Card Body Preview */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-zinc-500">
                  <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md">
                    <Tag className="w-3 h-3" /> {selectedCategoryName}
                  </span>
                  <span>{LEVEL_LABELS[level] ?? level}</span>
                </div>

                <h2 className="text-base font-bold text-zinc-950 leading-snug">
                  {title.trim() || 'Untitled Course'}
                </h2>

                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                  {shortDescription.trim() || 'Your one-line course summary will appear here on course cards.'}
                </p>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-950 text-sm">
                    {parseFloat(priceInr || '0') > 0 ? `₹${priceInr}` : 'Free'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-zinc-400">
                    <Clock className="w-3.5 h-3.5" />
                    {durationHours ? `${durationHours} hrs` : 'Self-paced'}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column: Course Details Form */}
          <main className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-7 shadow-xs">
              <div className="mb-6 pb-4 border-b border-zinc-100">
                <h2 className="text-base font-bold text-zinc-950">Course Details</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Fill in the details below. You can add sections, lessons, and Vimeo videos right after creating.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Full-Stack Web Development Bootcamp"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Cover Photo URL <span className="font-normal text-zinc-400">(optional, 16:9 recommended)</span>
                  </label>
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Short Description * <span className="font-normal text-zinc-400">(min 20 chars)</span>
                    </label>
                    <span className={`text-[11px] ${shortDescription.length >= 20 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {shortDescription.length}/20
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={20}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="One-line summary shown on course cards"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Full Description * <span className="font-normal text-zinc-400">(min 50 chars)</span>
                    </label>
                    <span className={`text-[11px] ${description.length >= 50 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {description.length}/50
                    </span>
                  </div>
                  <textarea
                    required
                    minLength={50}
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed course overview, outcomes, and syllabus..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Category *</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Level</label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="ALL_LEVELS">All Levels</option>
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Price (INR ₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={priceInr}
                      onChange={(e) => setPriceInr(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Duration (hours)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-950 text-white font-semibold py-3 rounded-xl hover:bg-zinc-800 disabled:opacity-60 text-sm transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Creating Course...
                      </>
                    ) : (
                      'Create Course & Open Builder'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
