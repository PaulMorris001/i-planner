import { Router } from 'express';
import { planRouter } from './plan.routes';
import { taskRouter } from './task.routes';
import { habitRouter } from './habit.routes';
import { goalRouter } from './goal.routes';

export const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth is handled client-side by Firebase Auth. Data routes below are protected
// via the requireAuth middleware, which verifies the Firebase ID token sent as
// `Authorization: Bearer <idToken>`.
router.use('/plans', planRouter);
router.use('/tasks', taskRouter);
router.use('/habits', habitRouter);
router.use('/goals', goalRouter);
