import { Response } from 'express';
import { AuthedRequest } from '../middleware/requireAuth';
import { listInbox, markAllRead, markRead } from '../services/inbox';

export async function getInbox(req: AuthedRequest, res: Response) {
  res.json(await listInbox(req.userId!));
}

export async function readOne(req: AuthedRequest, res: Response) {
  await markRead(req.userId!, String(req.params.id));
  res.status(204).end();
}

export async function readAll(req: AuthedRequest, res: Response) {
  await markAllRead(req.userId!);
  res.status(204).end();
}
