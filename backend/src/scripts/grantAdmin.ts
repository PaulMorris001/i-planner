// One-off admin script: gives an account the `admin` role (a Firebase custom claim), which lets it
// sign in to the admin dashboard. If the account does not exist yet it is CREATED with a password.
// Like grant-access, it is run by hand from a machine with backend/.env and is not an API route.
//
// Usage (from backend/):
//   npm run grant-admin -- someone@example.com                       # grant (creates the account if needed)
//   npm run grant-admin -- someone@example.com --password "My-Pass1" # choose the password for a new account
//   npm run grant-admin -- --revoke someone@example.com              # take the role away
//
// - A new account gets the password you pass with --password (at least 8 characters). Without it, a
//   strong random one is generated and printed ONCE: sign in, then change it.
// - An account that already exists keeps its password; only the role is added.
// - The person signs out and back in (or waits up to an hour) before their token carries the role.
import crypto from 'crypto';
import { firebaseAuth } from '../config/firebaseAdmin';

const MIN_PASSWORD_LENGTH = 8;
const GENERATED_LENGTH = 18;
// No look-alike characters (0/O, 1/l/I), so a generated password can be read off the screen.
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(length: number = GENERATED_LENGTH): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length * 2)) {
      if (byte < limit) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

interface ParsedArgs {
  emails: string[];
  revoke: boolean;
  password?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const emails: string[] = [];
  let revoke = false;
  let password: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--revoke') revoke = true;
    else if (arg === '--password') password = argv[++i];
    else if (arg.startsWith('--password=')) password = arg.slice('--password='.length);
    else if (!arg.startsWith('--') && arg.trim()) emails.push(arg.trim());
  }
  return { emails, revoke, password };
}

export type GrantResult =
  | { email: string; status: 'granted' | 'revoked'; created: false; uid: string }
  | { email: string; status: 'granted'; created: true; uid: string; password: string; generated: boolean }
  | { email: string; status: 'not-found' };

// Gives (or takes away) the admin role for one account, creating the account first when it is
// missing and a role is being granted. Exported so it can be tested without Firebase.
export async function grantAdminTo(email: string, options: { revoke: boolean; password?: string }): Promise<GrantResult> {
  let user;
  let created: { password: string; generated: boolean } | null = null;

  try {
    user = await firebaseAuth.getUserByEmail(email);
  } catch (err) {
    if ((err as { code?: string })?.code !== 'auth/user-not-found') throw err;
    // Nothing to revoke from an account that does not exist.
    if (options.revoke) return { email, status: 'not-found' };
    const generated = !options.password;
    const password = options.password ?? generatePassword();
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    user = await firebaseAuth.createUser({ email, password, emailVerified: true, displayName: 'Admin' });
    created = { password, generated };
  }

  const claims = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  if (options.revoke) delete claims.admin;
  else claims.admin = true;
  await firebaseAuth.setCustomUserClaims(user.uid, claims);

  if (created) return { email, status: 'granted', created: true, uid: user.uid, password: created.password, generated: created.generated };
  return { email, status: options.revoke ? 'revoked' : 'granted', created: false, uid: user.uid };
}

async function main() {
  const { emails, revoke, password } = parseArgs(process.argv.slice(2));
  if (!emails.length) {
    console.error('Usage: npm run grant-admin -- [--revoke] email@example.com [--password "..."]');
    process.exit(1);
  }
  if (password !== undefined && emails.length > 1) {
    console.error('--password can only be used with one email address at a time.');
    process.exit(1);
  }
  if (password !== undefined && password.length < MIN_PASSWORD_LENGTH) {
    console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  for (const email of emails) {
    try {
      const result = await grantAdminTo(email, { revoke, password });
      if (result.status === 'not-found') {
        console.log(`⚠️  ${email} has no account, so there is no admin role to remove.`);
      } else if (result.created) {
        console.log(`✅ Created ${email} and made it an admin (uid ${result.uid}).`);
        console.log(result.generated ? `   Password (shown once, change it after signing in): ${result.password}` : '   It uses the password you gave.');
      } else if (result.status === 'revoked') {
        console.log(`✅ ${email} is no longer an admin (uid ${result.uid}).`);
      } else {
        console.log(`✅ ${email} is now an admin (uid ${result.uid}). Its password was not changed.`);
      }
    } catch (err) {
      console.error(`❌ ${email}: ${(err as Error).message}`);
    }
  }
  process.exit(0);
}

// Only when run directly (`npm run grant-admin`), not when imported by a test.
if (require.main === module) {
  main();
}
