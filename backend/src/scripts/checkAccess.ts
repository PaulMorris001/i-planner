// One-off admin script: looks up each given email's Firebase UID and prints
// their actual stored Subscription doc — ground truth for "why does this
// account still look gated" support questions, bypassing any client-side
// caching/auth-mapping uncertainty. Read-only, safe to re-run.
//
// Usage (from backend/):
//   npm run check-access -- someone@example.com another@example.com
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { firebaseAuth } from '../config/firebaseAdmin';
import { Subscription } from '../models/Subscription';

async function main() {
  const emails = process.argv.slice(2).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) {
    console.error('Usage: npm run check-access -- email1@example.com email2@example.com ...');
    process.exit(1);
  }

  await connectDB();

  for (const email of emails) {
    try {
      const user = await firebaseAuth.getUserByEmail(email);
      const sub = await Subscription.findOne({ firebaseUid: user.uid });
      if (!sub) {
        console.log(`⚠️  ${email} (uid ${user.uid}) — no Subscription doc at all (defaults to 'free')`);
        continue;
      }
      console.log(
        `${email} (uid ${user.uid}) -> tier=${sub.tier}, comped=${sub.comped ?? false}, ` +
          `expiresAt=${sub.expiresAt ?? 'none'}, lastVerifiedAt=${sub.lastVerifiedAt}`
      );
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
