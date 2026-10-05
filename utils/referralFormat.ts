// Points as shown inside the small flame badge: "950", "1.2k", "12k". Short on
// purpose, since the number has to fit inside the flame.
export function formatPoints(points: number): string {
  if (points < 1000) return String(Math.max(0, Math.floor(points)));
  if (points < 10_000) return `${(Math.floor(points / 100) / 10).toString().replace(/\.0$/, '')}k`;
  return `${Math.floor(points / 1000)}k`;
}

// "ABCD2345" -> "ABCD 2345" for reading and reading aloud. The copied/shared
// value is always the plain code.
export function formatReferralCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

export function friendsLabel(count: number): string {
  return count === 1 ? '1 friend joined' : `${count} friends joined`;
}
