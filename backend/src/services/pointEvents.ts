import { PointEvent } from '../models/PointEvent';
import { Referral } from '../models/Referral';
import { isDuplicateKeyError } from '../utils/mongoErrors';

// Records an award, once per (account, key). Returns true only for the request
// that actually created it. Never adds points itself: see awardPoints.
export async function recordPointEvent(firebaseUid: string, key: string, type: string, points: number): Promise<boolean> {
  if (!(points > 0)) return false;
  try {
    await PointEvent.create({ firebaseUid, key, type, points });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

// Referral points paid before the points record existed have no PointEvent rows,
// so they would be missing from the weekly leaderboard. This copies them in once
// per server start. Safe to repeat: rows that already exist are skipped, and it
// never touches anyone's total (those points were already added).
let backfilled: Promise<void> | null = null;

export function ensureReferralEventsBackfilled(): Promise<void> {
  if (!backfilled) {
    backfilled = backfillReferralEvents().catch((err) => {
      console.error('[points] referral backfill failed', err);
      backfilled = null; // try again on the next request
    });
  }
  return backfilled;
}

async function backfillReferralEvents(): Promise<void> {
  const ops: Parameters<typeof PointEvent.bulkWrite>[0] = [];
  const flush = async () => {
    if (ops.length) await PointEvent.bulkWrite(ops.splice(0, ops.length), { ordered: false });
  };
  for await (const row of Referral.find().lean().cursor()) {
    ops.push(
      {
        updateOne: {
          filter: { firebaseUid: row.referrerUid, key: `referral:referrer:${row.referredUid}` },
          update: { $setOnInsert: { type: 'referral', points: row.referrerPoints, createdAt: row.createdAt } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { firebaseUid: row.referredUid, key: `referral:referred:${row.referredUid}` },
          update: { $setOnInsert: { type: 'referral', points: row.referredPoints, createdAt: row.createdAt } },
          upsert: true,
        },
      }
    );
    if (ops.length >= 500) await flush();
  }
  await flush();
}
