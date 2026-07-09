import { NextFunction, Request, Response } from 'express';
import { firebaseAuth } from '../config/firebaseAdmin';
import { ApiError } from '../utils/ApiError';

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return next(new ApiError(401, 'Authentication required.', 'general'));
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired session.', 'general'));
  }
}
