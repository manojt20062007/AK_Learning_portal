'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle, Printer, Loader2, XCircle, BookOpen } from 'lucide-react';

interface VerifiedCert {
  certificateNumber: string;
  verificationCode: string;
  issuedAt: string;
  studentName: string;
  studentId: string;
  courseTitle: string;
  durationHours?: number | null;
  level: string;
}

export default function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [cert, setCert] = useState<VerifiedCert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/certificates/verify/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCert(json.data);
        else setError(json.message || 'Certificate not found');
      })
      .catch(() => setError('Could not verify certificate'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-10 max-w-md w-full text-center shadow-sm">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Certificate</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Link href="/" className="text-brand-600 font-semibold text-sm hover:underline">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-3 py-1.5 rounded-full text-xs font-semibold">
          <CheckCircle className="w-4 h-4 text-green-600" /> Verified Authentic Certificate
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Certificate Canvas */}
      <div className="max-w-4xl mx-auto bg-white border-8 border-double border-brand-200 rounded-3xl p-10 md:p-14 shadow-xl text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">AK Learning</span>
        </div>

        <Award className="w-14 h-14 text-amber-500 mx-auto mb-4" />
        <div className="text-xs uppercase tracking-[0.25em] text-brand-600 font-semibold mb-2">
          Certificate of Completion
        </div>
        <p className="text-sm text-gray-500 mb-4">This certifies that</p>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{cert.studentName}</h1>
        <div className="text-xs font-mono text-gray-500 mb-6">Student ID: {cert.studentId}</div>

        <p className="text-sm text-gray-600 mb-2">has successfully completed the course</p>
        <h2 className="text-xl md:text-2xl font-bold text-brand-800 mb-8">{cert.courseTitle}</h2>

        <div className="grid sm:grid-cols-3 gap-4 pt-8 border-t border-gray-100 text-xs text-gray-500">
          <div>
            <div className="font-semibold text-gray-800">Issued Date</div>
            <div>{new Date(cert.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-800">Certificate No.</div>
            <div className="font-mono">{cert.certificateNumber}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-800">Verification Code</div>
            <div className="font-mono">{cert.verificationCode}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
