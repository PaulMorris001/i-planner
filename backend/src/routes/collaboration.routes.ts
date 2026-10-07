import { Router } from 'express';
import {
  acceptInvite,
  changeMemberRole,
  declineInvite,
  getNotePeople,
  getSharedNote,
  inviteMember,
  leaveNote,
  listMembers,
  listSharedWithMe,
  previewInvite,
  removeMember,
  resendInvite,
} from '../controllers/collaboration.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const collaborationRouter = Router();

collaborationRouter.use(requireAuth);

// Notes shared WITH me.
collaborationRouter.get('/notes', asyncHandler(listSharedWithMe));
collaborationRouter.get('/notes/:id', asyncHandler(getSharedNote));
// Who has access to a note (the owner and collaborators with their roles). Anyone with access can see it.
collaborationRouter.get('/notes/:id/people', asyncHandler(getNotePeople));
collaborationRouter.delete('/notes/:id/leave', asyncHandler(leaveNote));

// The owner managing who is invited.
collaborationRouter.get('/notes/:id/members', asyncHandler(listMembers));
collaborationRouter.post('/notes/:id/members', asyncHandler(inviteMember));
collaborationRouter.post('/notes/:id/members/:memberId/resend', asyncHandler(resendInvite));
collaborationRouter.patch('/notes/:id/members/:memberId', asyncHandler(changeMemberRole));
collaborationRouter.delete('/notes/:id/members/:memberId', asyncHandler(removeMember));

// The invitation behind the emailed link.
collaborationRouter.get('/invites/:token', asyncHandler(previewInvite));
collaborationRouter.post('/invites/:token/accept', asyncHandler(acceptInvite));
collaborationRouter.post('/invites/:token/decline', asyncHandler(declineInvite));
