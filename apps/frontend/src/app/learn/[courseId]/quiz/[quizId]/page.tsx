'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface QuizPayload {
  quiz: {
    id: string;
    title: string;
    description?: string | null;
    passingScore: number;
    timeLimit?: number | null;
    maxAttempts: number;
    questions: Array<{
      id: string;
      text: string;
      points: number;
      options: Array<{ id: string; text: string }>;
    }>;
  };
  attempts: Array<{
    id: string;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    completedAt: string;
  }>;
}

export default function StudentQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<QuizPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');

  const loadQuiz = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/quizzes/${quizId}`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.message || 'Quiz not available'); return; }
      setData(json.data);
    } catch {
      setError('Could not load quiz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuiz(); }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResultMsg('');
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/quizzes/${quizId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Submission failed');
        return;
      }
      setResultMsg(json.message);
      await loadQuiz();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-3 sticky top-0 z-30">
        <Link href={`/learn/${courseId}`} className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-gray-900 text-sm truncate">{data?.quiz.title ?? 'Quiz'}</h1>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {resultMsg && (
          <div className="bg-brand-50 border border-brand-100 text-brand-800 rounded-xl px-4 py-3 text-sm font-semibold">
            {resultMsg}
          </div>
        )}

        {data && (
          <>
            {/* Attempts Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div>
                <div className="font-bold text-gray-900">{data.quiz.title}</div>
                <div className="text-xs text-gray-500">
                  Passing score: {data.quiz.passingScore}% · Attempts: {data.attempts.length} / {data.quiz.maxAttempts}
                </div>
              </div>
              {data.attempts[0] && (
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                  data.attempts[0].passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {data.attempts[0].passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  Latest: {data.attempts[0].percentage}% ({data.attempts[0].score}/{data.attempts[0].maxScore})
                </div>
              )}
            </div>

            {data.attempts.length < data.quiz.maxAttempts ? (
              <form onSubmit={submitAttempt} className="space-y-4">
                {data.quiz.questions.map((q, idx) => (
                  <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                    <div className="font-semibold text-gray-900 text-sm mb-3">
                      {idx + 1}. {q.text}
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                            answers[q.id] === opt.id
                              ? 'border-brand-500 bg-brand-50 text-brand-900 font-medium'
                              : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.id}
                            checked={answers[q.id] === opt.id}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          />
                          <span>{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 disabled:opacity-60 text-sm"
                >
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              </form>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-600">
                Maximum attempts ({data.quiz.maxAttempts}) reached.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
