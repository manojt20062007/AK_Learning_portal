'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing setup token. Open the link from your invitation.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Could not set password.');
        return;
      }
      setDone(true);
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-7 text-center shadow-sm">
        <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-zinc-950 mb-1">Password set</h1>
        <p className="text-sm text-zinc-600 mb-6">
          Your account is active. Sign in with your email and new password.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full bg-zinc-950 text-white text-sm font-medium py-2.5 rounded-md hover:bg-zinc-800 transition-colors"
        >
          Go to sign in <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-7 shadow-sm">
      <h1 className="text-xl font-bold text-zinc-950 mb-1">Set your password</h1>
      <p className="text-sm text-zinc-500 mb-6">Choose a password to activate your student account</p>

      {!token && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2.5 mb-5 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>No setup token found in the URL.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2.5 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              className="w-full px-3 py-2 pr-9 rounded-md border border-zinc-300 text-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            required
            minLength={8}
            className="w-full px-3 py-2 rounded-md border border-zinc-300 text-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full flex items-center justify-center gap-2 bg-zinc-950 text-white text-sm font-medium py-2.5 rounded-md hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Activate account'}
        </button>
      </form>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-zinc-950 text-white flex items-center justify-center font-bold text-xs">
              AK
            </div>
            <span className="text-base font-semibold text-zinc-950">AK Learning</span>
          </Link>
        </div>
        <Suspense fallback={<div className="bg-white border border-zinc-200 rounded-xl p-6 text-sm text-zinc-500">Loading...</div>}>
          <SetupPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
