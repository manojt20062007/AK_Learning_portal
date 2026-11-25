import { Router } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError, ConflictError, AppError } from '../../middleware/errorHandler';

const router = Router();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// GET /api/admin/categories
router.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { courses: true } } },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: categories });
});

// GET /api/admin/categories/:id
router.get('/:id', async (req, res) => {
  const category = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: { courses: { select: { id: true, title: true, status: true } } },
  });
  if (!category) throw new NotFoundError('Category');
  res.json({ success: true, data: category });
});

// POST /api/admin/categories
router.post('/', async (req, res) => {
  const { name, description, iconUrl, color } = req.body as {
    name: string;
    description?: string;
    iconUrl?: string;
    color?: string;
  };

  if (!name || name.trim().length < 2) {
    throw new AppError('Category name must be at least 2 characters', 400);
  }

  const slug = generateSlug(name.trim());

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw new ConflictError('A category with this name already exists');

  const lastCategory = await prisma.category.findFirst({ orderBy: { order: 'desc' } });

  const category = await prisma.category.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() ?? null,
      iconUrl: iconUrl ?? null,
      color: color ?? null,
      order: (lastCategory?.order ?? -1) + 1,
    },
  });

  res.status(201).json({ success: true, data: category, message: 'Category created' });
});

// PATCH /api/admin/categories/:id
router.patch('/:id', async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) throw new NotFoundError('Category');

  const { name, description, iconUrl, color, isActive, order } = req.body as {
    name?: string;
    description?: string;
    iconUrl?: string;
    color?: string;
    isActive?: boolean;
    order?: number;
  };

  const updated = await prisma.category.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name: name.trim(), slug: generateSlug(name.trim()) }),
      ...(description !== undefined && { description }),
      ...(iconUrl !== undefined && { iconUrl }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
      ...(order !== undefined && { order }),
    },
  });

  res.json({ success: true, data: updated, message: 'Category updated' });
});

// DELETE /api/admin/categories/:id
router.delete('/:id', async (req, res) => {
  const category = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { courses: true } } },
  });
  if (!category) throw new NotFoundError('Category');

  if (category._count.courses > 0) {
    throw new AppError(`Cannot delete category with ${category._count.courses} course(s). Move or delete courses first.`, 400);
  }

  await prisma.category.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Category deleted' });
});

export default router;
