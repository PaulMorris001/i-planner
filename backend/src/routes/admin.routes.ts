import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getAdminAnalytics,
  getAdminAnnouncements,
  getAdminLeaderboard,
  getAdminMe,
  getAdminUsers,
  postAnnouncement,
  postRestoreUser,
  postSuspendUser,
} from '../controllers/admin.controller';

// Everything under /api/admin needs a signed-in account whose token carries the admin role.
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/me', getAdminMe);
adminRouter.get('/analytics', asyncHandler(getAdminAnalytics));
adminRouter.get('/users', asyncHandler(getAdminUsers));
adminRouter.post('/users/:uid/suspend', asyncHandler(postSuspendUser));
adminRouter.post('/users/:uid/restore', asyncHandler(postRestoreUser));
adminRouter.get('/leaderboard', asyncHandler(getAdminLeaderboard));
adminRouter.get('/announcements', asyncHandler(getAdminAnnouncements));
adminRouter.post('/announcements', asyncHandler(postAnnouncement));
