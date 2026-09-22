import { Router } from 'express';
import { planRouter } from './plan.routes';
import { taskRouter } from './task.routes';
import { habitRouter } from './habit.routes';
import { noteRouter } from './note.routes';
import { sharedNoteRouter } from './sharedNote.routes';
import { folderRouter } from './folder.routes';
import { billRouter } from './bill.routes';
import { savingsGoalRouter } from './savingsGoal.routes';
import { goalRouter } from './goal.routes';
import { settingsRouter } from './settings.routes';
import { coachRouter } from './coach.routes';
import { accountRouter } from './account.routes';
import { authEmailRouter } from './authEmail.routes';
import { syllabusRouter } from './syllabus.routes';
import { timetableRouter } from './timetable.routes';
import { googleOAuthRouter } from './googleOAuth.routes';
import { microsoftOAuthRouter } from './microsoftOAuth.routes';
import { subscriptionRouter } from './subscription.routes';
import { calendarImportRouter } from './calendarImport.routes';

export const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth is handled client-side by Firebase Auth. Data routes below are protected
// via the requireAuth middleware, which verifies the Firebase ID token sent as
// `Authorization: Bearer <idToken>`.
router.use('/plans', planRouter);
router.use('/tasks', taskRouter);
router.use('/habits', habitRouter);
router.use('/notes', noteRouter);
router.use('/shared-notes', sharedNoteRouter);
router.use('/folders', folderRouter);
router.use('/bills', billRouter);
router.use('/savings-goals', savingsGoalRouter);
router.use('/goals', goalRouter);
router.use('/settings', settingsRouter);
router.use('/coach', coachRouter);
router.use('/account', accountRouter);
router.use('/auth', authEmailRouter);
router.use('/syllabi', syllabusRouter);
router.use('/timetables', timetableRouter);
router.use('/subscription', subscriptionRouter);
router.use('/calendar', calendarImportRouter);

// Sibling to /settings, not nested — settingsRouter blanket-applies requireAuth,
// but this unauthenticated browser redirect can't carry one.
router.use('/oauth/google', googleOAuthRouter);
router.use('/oauth/microsoft', microsoftOAuthRouter);
