'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ArrowRight, User, Mail, Phone, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

export default function JoinCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();

  const [step, setStep] = useState<'info' | 'submitting' | 'done'>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [pricePaise, setPricePaise] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }

    setStep('submitting');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/course-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, studentName: name, studentEmail: email, studentPhone: phone }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Something went wrong');
        setStep('info');
        return;
      }

      setRequestId(data.data.requestId);
      setCourseTitle(data.data.courseTitle);
      setPricePaise(data.data.pricePaise);
      setStep('done');

      // Redirect to payment page
      router.push(`/pay/${data.data.requestId}?courseId=${courseId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&amount=${data.data.pricePaise}`);
    } catch {
      setError('Could not connect to server. Please try again.');
      setStep('info');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 text-sm">
          <Link href="/" className="text-gray-500 hover:text-gray-900">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <Link href="/courses" className="text-gray-500 hover:text-gray-900">Courses</Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-900 font-medium">Join Course</span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Enrollment</h1>
          <p className="text-gray-500 text-sm">
            Fill in your details to get started. After submitting, you&apos;ll be shown the payment instructions.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-brand-600">
            <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            Your Details
          </div>
          <div className="w-8 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-gray-400">
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold">2</div>
            Pay via UPI
          </div>
          <div className="w-8 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-gray-400">
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold">3</div>
            Get Access
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">+91</div>
                <Phone className="absolute left-10 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  required
                  className="w-full pl-16 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={step === 'submitting'}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {step === 'submitting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <>Continue to Payment <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-gray-400 mt-5">
            Your details are only used to create your student account after payment verification.
          </p>
        </div>
      </div>
    </div>
  );
}
