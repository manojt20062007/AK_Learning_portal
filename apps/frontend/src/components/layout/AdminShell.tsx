'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from './BrandLogo';
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Users,
  CreditCard,
  LogOut,
  ExternalLink,
  Radio,
} from 'lucide-react';

interface AdminShellProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen, exact: false },
  { href: '/admin/live', label: 'Live Classes', icon: Radio, exact: false },
  { href: '/admin/videos', label: 'Videos & R2', icon: Video, exact: false },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, exact: false },
  { href: '/admin/students', label: 'Students', icon: Users, exact: false },
];

export default function AdminShell({ title, actions, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-zinc-200 flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="h-14 flex items-center px-5 border-b border-zinc-200">
          <Link href="/admin" className="flex items-center">
            <BrandLogo size="sm" subtitle="Admin Console" />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <item.icon className={`w-4 h-4 ${active ? 'text-white' : 'text-zinc-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-200 space-y-1">
          <Link
            href="/courses"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
          >
            <span>View Public Site</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-zinc-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-semibold text-zinc-950 truncate">{title}</h1>
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>

        {/* Mobile Nav Strip */}
        <div className="md:hidden bg-white border-b border-zinc-200 px-4 py-2 flex gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  active ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full">{children}</main>
      </div>
    </div>
  );
}
