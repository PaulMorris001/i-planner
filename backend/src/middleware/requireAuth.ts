import { NextFunction, Request, Response } from 'express';
import { firebaseAuth } from '../config/firebaseAdmin';
import { ApiError } from '../utils/ApiError';
import { isSuspended, touchPresence } from '../services/accountStatus';

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
  // True for accounts granted the `admin` role (a Firebase custom claim set by `npm run grant-admin`).
  // Read from the verified ID token, so it can't be claimed by the client.
  isAdmin?: boolean;
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return next(new ApiError(401, 'Authentication required.', 'general'));
  }

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(token);
  } catch {
    return next(new ApiError(401, 'Invalid or expired session.', 'general'));
  }

  req.userId = decoded.uid;
  req.userEmail = decoded.email;
  req.isAdmin = decoded.admin === true;

  // A suspended account is refused everywhere (admins are never locked out by this check).
  if (!req.isAdmin && (await isSuspended(decoded.uid))) {
    return next(new ApiError(403, 'This account has been suspended. Please contact support.', 'suspended'));
  }

  touchPresence(decoded.uid);
  next();
}
