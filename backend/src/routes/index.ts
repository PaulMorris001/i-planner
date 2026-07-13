import { Router } from 'express';
import { planRouter } from './plan.routes';
import { taskRouter } from './task.routes';
import { habitRouter } from './habit.routes';
import { goalRouter } from './goal.routes';
import { settingsRouter } from './settings.routes';
import { googleOAuthRouter } from './googleOAuth.routes';

export const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth is handled client-side by Firebase Auth. Data routes below are protected
// via the requireAuth middleware, which verifies the Firebase ID token sent as
// `Authorization: Bearer <idToken>`.
router.use('/plans', planRouter);
router.use('/tasks', taskRouter);
router.use('/habits', habitRouter);
router.use('/goals', goalRouter);
router.use('/settings', settingsRouter);

// Google's OAuth redirect lands here directly (a browser navigation, not an
// authenticated API call) — kept as a sibling to /settings rather than nested under
// it, since settingsRouter blanket-applies requireAuth to everything it owns.
router.use('/oauth/google', googleOAuthRouter);
