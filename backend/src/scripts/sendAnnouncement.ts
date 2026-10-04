// Admin script: sends a push announcement (new feature, update, etc.) to every
// user who turned on "Product updates" in the app. Run by hand from a machine
// with backend/.env, like grant-access — not exposed as an API route.
//
// Usage (from backend/):
//   npm run announce -- --title "New: Outlook sync" --body "Connect it in Profile → Calendar Sync." --route profile
//
// Options:
//   --title   (required) notification title
//   --body    (required) notification text
//   --route   optional in-app screen to open on tap: notes, plans, coach, profile
//             (leading "/" optional -- leave it off in Git Bash, which mangles it)
//   --to      send only to these account emails (comma-separated) — test first!
//   --dry-run show how many devices would get it, without sending
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { firebaseAuth } from '../config/firebaseAdmin';
import { announcementTokens, sendPushToTokens } from '../services/pushNotifications';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

// Git Bash on Windows rewrites any argument starting with "/" into a Windows
// path ("/profile" arrives as "C:/Program Files/Git/profile"). Undo that, and
// accept the route with or without its leading slash ("profile" -> "/profile").
function normalizeRoute(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const msys = raw.replace(/\\/g, '/').match(/^[A-Za-z]:\/.*?\/Git(\/.*)$/);
  const route = msys ? msys[1] : raw;
  return route.startsWith('/') ? route : `/${route}`;
}

async function main() {
  const title = arg('title')?.trim();
  const body = arg('body')?.trim();
  const route = normalizeRoute(arg('route')?.trim());
  const to = arg('to');
  const dryRun = process.argv.includes('--dry-run');

  if (!title || !body) {
    console.error('Usage: npm run announce -- --title "..." --body "..." [--route /notes] [--to a@b.com] [--dry-run]');
    process.exit(1);
  }
  if (route && !route.startsWith('/')) {
    console.error('--route must be an in-app path starting with "/", e.g. /notes');
    process.exit(1);
  }

  await connectDB();

  let onlyUids: string[] | undefined;
  if (to) {
    const emails = to.split(',').map((e) => e.trim()).filter(Boolean);
    onlyUids = [];
    for (const email of emails) {
      try {
        onlyUids.push((await firebaseAuth.getUserByEmail(email)).uid);
      } catch {
        console.error(`❌ No account for ${email}`);
      }
    }
  }

  console.log(`Title: ${title}\nBody: ${body}\nOpens: ${route ?? '(app home)'}`);
  const tokens = await announcementTokens(onlyUids);
  console.log(`${tokens.length} device(s) opted in${to ? ` for ${to}` : ''}.`);
  if (to && !tokens.length) {
    console.log('Tip: that account needs "Product updates" switched on in Profile, on a build with push support.');
  }

  if (dryRun || !tokens.length) {
    if (dryRun) console.log('Dry run — nothing sent.');
    await mongoose.disconnect();
    return;
  }

  const result = await sendPushToTokens(tokens, { title, body, route });
  console.log(
    `✅ Accepted by Expo: ${result.accepted}/${result.targeted}` +
      (result.failed ? ` | failed: ${result.failed}` : '') +
      (result.removedTokens ? ` | removed ${result.removedTokens} dead token(s)` : '')
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
