'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  Search, ChevronDown, ExternalLink, MessageCircle, Copy, QrCode
} from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';

interface Payment {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  utrNumber: string;
  paymentDate: string;
  amountPaise: number;
  paymentApp: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
    PENDING: { icon: <Clock className="w-3.5 h-3.5" />, cls: 'bg-orange-50 text-orange-700 border-orange-100', label: 'Pending' },
    APPROVED: { icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'bg-green-50 text-green-700 border-green-100', label: 'Approved' },
    REJECTED: { icon: <XCircle className="w-3.5 h-3.5" />, cls: 'bg-red-50 text-red-700 border-red-100', label: 'Rejected' },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [approvedInvite, setApprovedInvite] = useState<{
    studentId: string;
    studentEmail: string;
    emailSent?: boolean;
    whatsappUrl?: string;
    whatsappMessage?: string;
    setupLink?: string;
  } | null>(null);

  // UPI Settings Modal state
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [upiDisplayName, setUpiDisplayName] = useState('AK Learning');
  const [upiPreviewQr, setUpiPreviewQr] = useState<string | null>(null);
  const [savingUpi, setSavingUpi] = useState(false);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/payments${qs}`, {
        credentials: 'include',
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (data.success) setPayments(data.data);
      else setError(data.message);
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPayments(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/upi`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setUpiId(d.data.upiId ?? '');
          setUpiDisplayName(d.data.displayName ?? 'AK Learning');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!upiId.trim()) {
      setUpiPreviewQr(null);
      return;
    }
    const uri = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(upiDisplayName.trim() || 'AK Learning')}&cu=INR`;
    QRCode.toDataURL(uri, { width: 220, margin: 2 })
      .then(setUpiPreviewQr)
      .catch(() => setUpiPreviewQr(null));
  }, [upiId, upiDisplayName]);

  const saveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUpi(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/upi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          upiId: upiId.trim(),
          displayName: upiDisplayName.trim() || 'AK Learning',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to save UPI settings');
        return;
      }
      setShowUpiModal(false);
      setActionSuccess(`UPI settings saved (${upiId.trim()}). QR code will auto-generate on checkout.`);
    } finally {
      setSavingUpi(false);
    }
  };

  const approve = async (id: string) => {
    setActionLoading(true);
    setActionSuccess('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/payments/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: '' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Approved! Student ID: ${data.data.studentId}`);
        setApprovedInvite(data.data);
        setSelected(null);
        loadPayments();
      } else {
        setError(data.message);
      }
    } catch {
      setError('Failed to approve payment');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { setError('Rejection reason is required'); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/payments/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRejectForm(false);
        setRejectReason('');
        setSelected(null);
        loadPayments();
      } else {
        setError(data.message);
      }
    } catch {
      setError('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminShell
      title="Payment Verification"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpiModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-zinc-300 rounded-md bg-white text-zinc-800 hover:bg-zinc-50"
          >
            <QrCode className="w-3.5 h-3.5" /> UPI & QR Settings
          </button>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-1.5 text-xs font-medium border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none bg-white"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      }
    >
      <div>
        {actionSuccess && (
          <div className="bg-green-50 border border-green-100 text-green-800 rounded-2xl p-4 mb-4 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> {actionSuccess}
              {approvedInvite && (
                <span className="ml-auto text-xs font-normal text-green-700">
                  {approvedInvite.emailSent ? 'Brevo Email Sent ✓' : 'Brevo SMTP not configured — send via WhatsApp below'}
                </span>
              )}
            </div>
            {approvedInvite && (
              <div className="flex flex-wrap gap-2 mt-2">
                {approvedInvite.whatsappUrl && (
                  <a
                    href={approvedInvite.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-700"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp Invite <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {approvedInvite.whatsappMessage && (
                  <button
                    onClick={() => navigator.clipboard.writeText(approvedInvite.whatsappMessage!)}
                    className="inline-flex items-center gap-1.5 bg-white border border-green-200 text-green-800 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-100"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy WhatsApp Message
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No {statusFilter.toLowerCase() || ''} payments</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">UTR</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{p.studentName}</div>
                      <div className="text-xs text-gray-400">{p.studentEmail}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-900">{p.utrNumber}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">₹{(p.amountPaise / 100).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-4">
                      {p.status === 'PENDING' ? (
                        <button
                          onClick={() => { setSelected(p); setShowRejectForm(false); setError(''); }}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                        >
                          Review
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment Detail Panel */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-7 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Review Payment</h2>
                <button onClick={() => { setSelected(null); setShowRejectForm(false); }} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
              </div>

              {actionSuccess && (
                <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">{actionSuccess}</div>
              )}

              <div className="space-y-3 mb-6">
                {[
                  { label: 'Student Name', value: selected.studentName },
                  { label: 'Email', value: selected.studentEmail },
                  { label: 'Phone', value: selected.studentPhone },
                  { label: 'UTR Number', value: selected.utrNumber, mono: true },
                  { label: 'Amount', value: `₹${(selected.amountPaise / 100).toLocaleString('en-IN')}` },
                  { label: 'Payment App', value: selected.paymentApp ?? 'Not specified' },
                  { label: 'Payment Date', value: new Date(selected.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                  { label: 'Submitted', value: new Date(selected.createdAt).toLocaleString('en-IN') },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between items-start gap-4 py-2 border-b border-gray-50">
                    <span className="text-xs font-medium text-gray-500 flex-shrink-0">{label}</span>
                    <span className={`text-sm text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
                  </div>
                ))}
                {selected.screenshotUrl && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-medium text-gray-500">Screenshot</span>
                    <a href={selected.screenshotUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:underline">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5 text-xs text-amber-800">
                <strong>Important:</strong> Manually verify this UTR in your bank/UPI app before approving.
                Check that ₹{(selected.amountPaise / 100).toLocaleString('en-IN')} was received from {selected.studentPhone}.
              </div>

              {!showRejectForm ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => approve(selected.id)}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-70 transition-colors text-sm"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve & Create Account
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-50 transition-colors text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. UTR not found in bank statement, Incorrect amount..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => reject(selected.id)}
                      disabled={actionLoading}
                      className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-70 text-sm"
                    >
                      {actionLoading ? '...' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                      className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* UPI & QR Settings Modal */}
        {showUpiModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <QrCode className="w-4 h-4" /> UPI & Auto-QR Settings
                </h2>
                <button onClick={() => setShowUpiModal(false)} className="text-zinc-400 hover:text-zinc-700">
                  ✕
                </button>
              </div>

              {upiPreviewQr && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={upiPreviewQr}
                    alt="UPI QR Preview"
                    className="w-40 h-40 mx-auto rounded-lg bg-white p-1 border border-zinc-200"
                  />
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Auto-generated QR preview (exact course amount is added automatically at checkout)
                  </p>
                </div>
              )}

              <form onSubmit={saveUpiSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">UPI ID *</label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@okaxis"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    required
                    value={upiDisplayName}
                    onChange={(e) => setUpiDisplayName(e.target.value)}
                    placeholder="AK Learning"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="w-full bg-zinc-950 text-white font-semibold py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm"
                >
                  {savingUpi ? 'Saving...' : 'Save UPI Settings'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
