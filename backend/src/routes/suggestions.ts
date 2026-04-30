import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  createSuggestion,
  getSuggestions,
  getMySuggestions,
  reviewSuggestion,
  SuggestionType,
  SuggestionStatus,
} from '../services/suggestion.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/suggestions — member submits a suggestion
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { type, title, details } = req.body as {
    type: SuggestionType;
    title: string;
    details?: string;
  };
  if (!type || !['meal', 'shopping_item'].includes(type)) {
    throw new AppError(400, 'type must be "meal" or "shopping_item"');
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new AppError(400, 'title is required');
  }
  const suggestion = await createSuggestion(req.user!.id, type, title.trim(), details?.trim());
  res.status(201).json(suggestion);
});

// GET /api/suggestions — owner sees all household suggestions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const suggestions = await getSuggestions(req.user!.id);
  res.json(suggestions);
});

// GET /api/suggestions/mine — member sees their own submissions
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  const suggestions = await getMySuggestions(req.user!.id);
  res.json(suggestions);
});

// PATCH /api/suggestions/:id — owner approves/denies
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { status, adminNotes } = req.body as { status: SuggestionStatus; adminNotes?: string };
  if (!status || !['APPROVED', 'DENIED'].includes(status)) {
    throw new AppError(400, 'status must be "APPROVED" or "DENIED"');
  }
  const updated = await reviewSuggestion(
    req.user!.id,
    req.params.id,
    status,
    adminNotes
  );
  res.json(updated);
});

export default router;
