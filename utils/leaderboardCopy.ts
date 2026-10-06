import type { Leaderboard } from '@/types/referral.types';

// The motivating one-liner in the leaderboard hero: how far you are from the next
// place up. Ranks are unique and a tie goes to whoever got there first, so to
// overtake someone you need one point MORE than they have.
export function motivationLine(board: Leaderboard): string {
  const { rank, points } = board.you;
  if (!rank || points <= 0) return 'Earn your first points this week to get on the board.';
  if (rank === 1) return "You're in the lead. Keep going to stay on top!";

  const index = board.top.findIndex((entry) => entry.isYou);
  if (index > 0) {
    const need = board.top[index - 1].points - points + 1;
    return `${need} more ${need === 1 ? 'point' : 'points'} to reach #${rank - 1}.`;
  }

  // Outside the top 10: the target is the last place on the board.
  const last = board.top[board.top.length - 1];
  if (!last) return 'Earn points to climb the board.';
  const need = last.points - points + 1;
  return `${need} more ${need === 1 ? 'point' : 'points'} to reach the top ${board.top.length}.`;
}

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#6366F1'];

// A steady colour per name, so the same person always has the same avatar.
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// "user7k2m9qx" -> "7": the first character after the "user" prefix.
export function avatarLetter(handle: string): string {
  const body = handle.replace(/^user/i, '');
  return (body[0] ?? handle[0] ?? '?').toUpperCase();
}
