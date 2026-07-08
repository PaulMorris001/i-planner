import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, field: err.field });
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({ message: 'That value is already in use.', field: 'general' });
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong.', field: 'general' });
}
