// One-off admin script: grants the top subscription tier (unlocks every
// feature — see constants/featureTiers.ts's TIER_RANK — plus the highest AI
// usage cap in constants/aiUsage.ts) to specific curated users, identified by
// the email on their Firebase account. Not exposed as an API route — this is
// meant to be run by hand from a machine with backend/.env available, not
// something the app or a client can trigger.
//
// Usage (from backend/):
//   npm run grant-access -- someone@example.com another@example.com
//
// Safe to re-run — upserts, so re-granting an already-comped user is a no-op
// besides refreshing lastVerifiedAt.
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { firebaseAuth } from '../config/firebaseAdmin';
import { Subscription } from '../models/Subscription';

async function main() {
  const emails = process.argv.slice(2).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) {
    console.error('Usage: npm run grant-access -- email1@example.com email2@example.com ...');
    process.exit(1);
  }

  await connectDB();

  for (const email of emails) {
    try {
      const user = await firebaseAuth.getUserByEmail(email);
      await Subscription.findOneAndUpdate(
        { firebaseUid: user.uid },
        {
          $set: { tier: 'premium', comped: true, lastVerifiedAt: new Date() },
          // Clear any expiry left over from a past real purchase — comped
          // access doesn't lapse on its own.
          $unset: { expiresAt: '' },
        },
        { upsert: true, new: true }
      );
      console.log(`✅ ${email} -> premium (uid ${user.uid})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ ${email} — ${message}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
