import Link from 'next/link';
import BrandLogo from './BrandLogo';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-zinc-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <BrandLogo size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
          <Link href="/courses" className="hover:text-zinc-950 transition-colors">
            Courses
          </Link>
          <Link href="/dashboard" className="hover:text-zinc-950 transition-colors">
            Student Portal
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-950 px-3 py-1.5 rounded-md hover:bg-zinc-100 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/courses"
            className="text-sm font-medium bg-zinc-950 text-white px-4 py-2 rounded-md hover:bg-zinc-800 transition-colors"
          >
            Browse courses
          </Link>
        </div>
      </div>
    </header>
  );
}
