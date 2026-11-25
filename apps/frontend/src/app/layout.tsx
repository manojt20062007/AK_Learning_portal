import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'AK Learning — Practical Engineering & Career Courses',
    template: '%s | AK Learning',
  },
  description:
    'Structured video courses, practical assessments, and verified certificates built for focused learners.',
  keywords: ['online learning', 'courses', 'education', 'skills', 'training'],
  authors: [{ name: 'AK Learning' }],
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className={`${jakarta.className} min-h-screen bg-[#FAFAFA] text-zinc-950 antialiased`}>
        {children}
      </body>
    </html>
  );
}
