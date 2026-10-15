import { NextFunction, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import type { AuthedRequest } from './requireAuth';

// After requireAuth: only accounts whose verified token carries the `admin` claim get through.
// Everyone else gets the same plain 404 an unknown route would, so the admin API is not advertised.
export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (!req.isAdmin) return next(new ApiError(404, 'Not found.', 'general'));
  next();
}
