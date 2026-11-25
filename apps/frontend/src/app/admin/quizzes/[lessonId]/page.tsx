'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, CheckCircle, Globe, Loader2, AlertCircle } from 'lucide-react';

interface OptionItem {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionItem {
  id: string;
  text: string;
  points: number;
  options: OptionItem[];
}

interface QuizData {
  id: string;
  title: string;
  description?: string | null;
  passingScore: number;
  timeLimit?: number | null;
  maxAttempts: number;
  isPublished: boolean;
  questions: QuestionItem[];
}

export default function AdminQuizBuilderPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Quiz settings form
  const [title, setTitle] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [timeLimit, setTimeLimit] = useState('');

  // New question form
  const [qText, setQText] = useState('');
  const [optTexts, setOptTexts] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);

  const loadQuiz = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/quizzes/lesson/${lessonId}`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.message || 'Failed to load'); return; }

      setLessonTitle(json.data.lesson.title);
      setCourseId(json.data.lesson.section.courseId);
      const q: QuizData | null = json.data.quiz;
      setQuiz(q);
      if (q) {
        setTitle(q.title);
        setPassingScore(q.passingScore);
        setMaxAttempts(q.maxAttempts);
        setTimeLimit(q.timeLimit ? String(q.timeLimit) : '');
      } else {
        setTitle(`${json.data.lesson.title} — Quiz`);
      }
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuiz(); }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveQuizSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lessonId,
          title,
          passingScore: Number(passingScore),
          maxAttempts: Number(maxAttempts),
          timeLimit: timeLimit ? Number(timeLimit) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message); return; }
      await loadQuiz();
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!quiz) return;
    setError('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/quizzes/${quiz.id}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isPublished: !quiz.isPublished }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    loadQuiz();
  };

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz) return;
    setError('');
    const filledOptions = optTexts
      .map((t, idx) => ({ text: t.trim(), isCorrect: idx === correctIndex }))
      .filter((o) => o.text.length > 0);

    if (filledOptions.length < 2) {
      setError('Provide at least 2 options');
      return;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/quizzes/${quiz.id}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text: qText, options: filledOptions }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message); return; }
    setQText('');
    setOptTexts(['', '', '', '']);
    setCorrectIndex(0);
    loadQuiz();
  };

  const deleteQuestion = async (questionId: string) => {
    if (!quiz) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/quizzes/${quiz.id}/questions/${questionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    loadQuiz();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 h-16 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href={courseId ? `/admin/courses/${courseId}` : '/admin/courses'} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">Quiz Builder</h1>
            <p className="text-xs text-gray-500">{lessonTitle}</p>
          </div>
        </div>
        {quiz && (
          <button
            onClick={togglePublish}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg ${
              quiz.isPublished ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-brand-600 text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> {quiz.isPublished ? 'Published (Click to Unpublish)' : 'Publish Quiz'}
          </button>
        )}
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Quiz Settings */}
        <form onSubmit={saveQuizSettings} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-gray-900 text-sm">Quiz Settings</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quiz Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Passing Score (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Attempts</label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Time Limit (min, optional)</label>
              <input
                type="number"
                min={1}
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                placeholder="No limit"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-brand-700"
          >
            {saving ? 'Saving...' : quiz ? 'Update Settings' : 'Create Quiz'}
          </button>
        </form>

        {/* Questions */}
        {quiz && (
          <>
            <div className="space-y-3">
              {quiz.questions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="font-semibold text-sm text-gray-900">
                      Q{idx + 1}. {q.text}
                    </div>
                    <button onClick={() => deleteQuestion(q.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                          opt.isCorrect ? 'bg-green-50 text-green-800 font-semibold' : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {opt.isCorrect && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                        <span>{opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Question */}
            <form onSubmit={addQuestion} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm">Add Multiple-Choice Question</h3>
              <textarea
                required
                rows={2}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Enter question..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
              <div className="space-y-2">
                {optTexts.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={correctIndex === idx}
                      onChange={() => setCorrectIndex(idx)}
                    />
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const next = [...optTexts];
                        next[idx] = e.target.value;
                        setOptTexts(next);
                      }}
                      placeholder={`Option ${idx + 1}${idx < 2 ? ' *' : ' (optional)'}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-black"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
