import { Router } from 'express';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../middleware/errorHandler';

const router = Router();

// GET /api/admin/quizzes/lesson/:lessonId
router.get('/lesson/:lessonId', async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.lessonId },
    select: {
      id: true,
      title: true,
      section: { select: { courseId: true, course: { select: { title: true } } } },
    },
  });
  if (!lesson) throw new NotFoundError('Lesson');

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: req.params.lessonId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: { orderBy: { order: 'asc' } },
        },
      },
      _count: { select: { attempts: true } },
    },
  });

  res.json({ success: true, data: { lesson, quiz } });
});

// POST /api/admin/quizzes - Create or update quiz for a lesson
router.post('/', async (req, res) => {
  const { lessonId, title, description, passingScore, timeLimit, maxAttempts, isPublished } = req.body as {
    lessonId?: string;
    title?: string;
    description?: string;
    passingScore?: number;
    timeLimit?: number | null;
    maxAttempts?: number;
    isPublished?: boolean;
  };

  if (!lessonId || !title || title.trim().length < 2) {
    throw new AppError('lessonId and title are required', 400);
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new NotFoundError('Lesson');

  const quiz = await prisma.quiz.upsert({
    where: { lessonId },
    create: {
      lessonId,
      title: title.trim(),
      description: description?.trim() ?? null,
      passingScore: passingScore ?? 70,
      timeLimit: timeLimit ?? null,
      maxAttempts: maxAttempts ?? 3,
      isPublished: isPublished ?? false,
    },
    update: {
      title: title.trim(),
      description: description?.trim() ?? null,
      ...(passingScore !== undefined && { passingScore }),
      ...(timeLimit !== undefined && { timeLimit }),
      ...(maxAttempts !== undefined && { maxAttempts }),
      ...(isPublished !== undefined && { isPublished }),
    },
  });

  res.status(201).json({ success: true, data: quiz, message: 'Quiz saved' });
});

// PATCH /api/admin/quizzes/:quizId/publish
router.patch('/:quizId/publish', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.quizId },
    include: { _count: { select: { questions: true } } },
  });
  if (!quiz) throw new NotFoundError('Quiz');

  const nextPublished = (req.body as { isPublished?: boolean })?.isPublished ?? !quiz.isPublished;
  if (nextPublished && quiz._count.questions === 0) {
    throw new AppError('Add at least one question before publishing this quiz', 400);
  }

  const updated = await prisma.quiz.update({
    where: { id: quiz.id },
    data: { isPublished: nextPublished },
  });

  res.json({ success: true, data: updated, message: nextPublished ? 'Quiz published' : 'Quiz unpublished' });
});

// POST /api/admin/quizzes/:quizId/questions
router.post('/:quizId/questions', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.quizId } });
  if (!quiz) throw new NotFoundError('Quiz');

  const { text, explanation, points, options } = req.body as {
    text?: string;
    explanation?: string;
    points?: number;
    options?: Array<{ text: string; isCorrect: boolean }>;
  };

  if (!text || text.trim().length < 3) {
    throw new AppError('Question text is required', 400);
  }
  if (!Array.isArray(options) || options.length < 2) {
    throw new AppError('At least 2 options are required', 400);
  }
  if (!options.some((o) => o.isCorrect)) {
    throw new AppError('Mark at least one option as correct', 400);
  }

  const lastQ = await prisma.question.findFirst({
    where: { quizId: quiz.id },
    orderBy: { order: 'desc' },
  });

  const question = await prisma.question.create({
    data: {
      quizId: quiz.id,
      text: text.trim(),
      explanation: explanation?.trim() ?? null,
      points: points ?? 1,
      order: (lastQ?.order ?? -1) + 1,
      options: {
        create: options.map((opt, idx) => ({
          text: opt.text.trim(),
          isCorrect: Boolean(opt.isCorrect),
          order: idx,
        })),
      },
    },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  res.status(201).json({ success: true, data: question, message: 'Question added' });
});

// DELETE /api/admin/quizzes/:quizId/questions/:questionId
router.delete('/:quizId/questions/:questionId', async (req, res) => {
  const question = await prisma.question.findFirst({
    where: { id: req.params.questionId, quizId: req.params.quizId },
  });
  if (!question) throw new NotFoundError('Question');

  await prisma.question.delete({ where: { id: question.id } });
  res.json({ success: true, message: 'Question deleted' });
});

export default router;
