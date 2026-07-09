import { Response } from 'express';
import { Plan, PATH_TYPES, PathType } from '../models/Plan';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';

function assertValidPathType(pathType: string): asserts pathType is PathType {
  if (!(PATH_TYPES as readonly string[]).includes(pathType)) {
    throw new ApiError(400, `Invalid plan type: ${pathType}`, 'general');
  }
}

export async function getPlan(req: AuthedRequest, res: Response) {
  const { pathType } = req.params;
  assertValidPathType(pathType);

  const plan = await Plan.findOne({ firebaseUid: req.userId, pathType });
  res.json({ data: plan?.data ?? null });
}

export async function savePlan(req: AuthedRequest, res: Response) {
  const { pathType } = req.params;
  assertValidPathType(pathType);

  const { data } = req.body ?? {};
  if (data === undefined) {
    throw new ApiError(400, 'Missing plan data.', 'general');
  }

  const plan = await Plan.findOneAndUpdate(
    { firebaseUid: req.userId, pathType },
    { data, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  res.json({ data: plan.data });
}
