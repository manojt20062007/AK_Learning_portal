'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  Copy, CheckCircle, AlertCircle, Loader2, ChevronRight,
  Smartphone, Calendar, Hash, QrCode, ArrowRight, ExternalLink
} from 'lucide-react';

interface UpiSettings {
  upiId: string | null;
  displayName: string | null;
  qrCodeUrl: string | null;
}

export default function PaymentPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') ?? '';
  const studentName = searchParams.get('name') ?? '';
  const studentEmail = searchParams.get('email') ?? '';
  const studentPhone = searchParams.get('phone') ?? '';
  const amountPaise = parseInt(searchParams.get('amount') ?? '0', 10);

  const [upi, setUpi] = useState<UpiSettings | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [utr, setUtr] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentApp, setPaymentApp] = useState('GOOGLE_PAY');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [paymentId, setPaymentId] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/upi`)
      .then((r) => r.json())
      .then((d) => setUpi(d.data))
      .catch(() => setUpi({ upiId: 'admin@upi', displayName: 'AK Learning', qrCodeUrl: null }));
  }, []);

  const upiDeepLink = useMemo(() => {
    if (!upi?.upiId) return '';
    const params = new URLSearchParams({
      pa: upi.upiId,
      pn: upi.displayName || 'AK Learning',
      cu: 'INR',
      tn: `Course Enrollment ${requestId.slice(0, 8)}`,
    });
    if (amountPaise > 0) {
      params.set('am', (amountPaise / 100).toFixed(2));
    }
    return `upi://pay?${params.toString()}`;
  }, [upi, amountPaise, requestId]);

  useEffect(() => {
    if (!upiDeepLink) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(upiDeepLink, { width: 280, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [upiDeepLink]);

  const copyUpi = () => {
    if (upi?.upiId) {
      navigator.clipboard.writeText(upi.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!utr.trim() || utr.trim().length < 6) {
      setError('Please enter a valid UTR number (minimum 6 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseRequestId: requestId,
          courseId,
          studentName,
          studentEmail,
          studentPhone,
          utrNumber: utr.trim().toUpperCase(),
          paymentDate: new Date(paymentDate).toISOString(),
          amountPaise,
          paymentApp,
          screenshotUrl: screenshotUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Submission failed. Please try again.');
        return;
      }

      setPaymentId(data.data.paymentId);
      setSubmitted(true);
    } catch {
      setError('Could not connect to server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-success-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your UTR <span className="font-mono font-bold text-gray-900">{utr}</span> has been submitted
            for verification. Admin will verify and create your account within 24 hours.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900 text-xs">{studentEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium text-gray-900">₹{(amountPaise / 100).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Pending Verification</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            You&apos;ll receive your login credentials via email once verified.
            Reference ID: <span className="font-mono">{paymentId.slice(0, 8)}</span>
          </p>
          <Link href="/" className="text-brand-600 font-medium text-sm hover:text-brand-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 text-sm">
          <Link href="/" className="text-gray-500 hover:text-gray-900">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <Link href="/courses" className="text-gray-500 hover:text-gray-900">Courses</Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-900 font-medium">Payment</span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-success-500">
            <div className="w-6 h-6 rounded-full bg-success-500 text-white flex items-center justify-center text-xs">✓</div>
            Your Details
          </div>
          <div className="w-8 h-px bg-brand-200" />
          <div className="flex items-center gap-1.5 text-brand-600">
            <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">2</div>
            Pay via UPI
          </div>
          <div className="w-8 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-gray-400">
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold">3</div>
            Get Access
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* UPI Payment Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-brand-500" />
              Pay via UPI
            </h2>

            <div className="text-center mb-5">
              <div className="text-3xl font-bold text-gray-900">
                ₹{(amountPaise / 100).toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-gray-500">Course enrollment fee</div>
            </div>

            {/* QR Code (auto-generated from UPI ID + exact amount, or custom uploaded QR) */}
            {(qrDataUrl || upi?.qrCodeUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl || upi?.qrCodeUrl || ''}
                alt="UPI QR Code"
                className="w-48 h-48 mx-auto mb-4 rounded-xl border-2 border-gray-100 bg-white p-1"
              />
            ) : (
              <div className="w-48 h-48 mx-auto mb-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                <QrCode className="w-10 h-10 text-gray-300 mb-2" />
                <span className="text-xs text-gray-400">QR Code</span>
              </div>
            )}

            {/* Mobile UPI App Deep Link Button */}
            {upiDeepLink && (
              <a
                href={upiDeepLink}
                className="flex md:hidden items-center justify-center gap-2 w-full bg-zinc-950 text-white font-semibold py-3 px-4 rounded-xl hover:bg-zinc-800 transition-colors text-sm mb-4 shadow-sm"
              >
                <Smartphone className="w-4 h-4" />
                Pay ₹{(amountPaise / 100).toLocaleString('en-IN')} via UPI App
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            )}

            {/* UPI ID */}
            {upi?.upiId && (
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">UPI ID</div>
                  <div className="font-mono font-semibold text-gray-900 text-sm">{upi.upiId}</div>
                  {upi.displayName && (
                    <div className="text-xs text-gray-500">{upi.displayName}</div>
                  )}
                </div>
                <button
                  onClick={copyUpi}
                  className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    copied
                      ? 'bg-success-100 text-success-700'
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  {copied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-1.5 bg-blue-50 rounded-xl p-3">
              <div className="font-semibold text-blue-700 mb-1">Payment steps:</div>
              <div>1. Open Google Pay, PhonePe, or any UPI app</div>
              <div>2. Scan QR code or enter UPI ID</div>
              <div>3. Enter exact amount: ₹{(amountPaise / 100).toLocaleString('en-IN')}</div>
              <div>4. Note down the UTR/transaction ID</div>
              <div>5. Submit the form on the right →</div>
            </div>
          </div>

          {/* UTR Submission Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-brand-500" />
              Submit Payment Details
            </h2>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-3 py-2.5 mb-4 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UTR / Transaction ID *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="e.g. 123456789012"
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Found in your UPI app payment history</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment App</label>
                <select
                  value={paymentApp}
                  onChange={(e) => setPaymentApp(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="GOOGLE_PAY">Google Pay</option>
                  <option value="PHONEPE">PhonePe</option>
                  <option value="PAYTM">Paytm</option>
                  <option value="BHIM">BHIM UPI</option>
                  <option value="OTHER">Other UPI App</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Screenshot URL (optional)</label>
                <input
                  type="url"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Upload to Google Drive / Imgur and paste link</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : (
                  <>Submit Payment <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
