import crypto from 'crypto';

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// The secret in an emailed invitation link. Only its hash is ever stored, so a copy of the
// database can't be used to accept anyone's invitation.
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}
