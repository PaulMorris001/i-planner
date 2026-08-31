// Whole-dollar display only (no cents) — matches every currency value in the
// savings-goal UI (target/saved amounts move in $50/$100 steps, so cents never occur).
export function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

// Loose "Jun 2027"-style free text, not a real date field — whole months from
// today, or null if it doesn't parse or is already in the past.
export function monthsUntil(targetDateText: string): number | null {
  if (!targetDateText.trim()) return null;
  const target = new Date(targetDateText.trim());
  if (Number.isNaN(target.getTime())) return null;
  const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
  const months = Math.round((target.getTime() - Date.now()) / msPerMonth);
  return months > 0 ? months : null;
}

// "Set aside $X/mo" figure shared by SavingsGoalModal's live preview and
// SavingsGoalCard's display on all three dashboards — null (hidden entirely)
// when the target date doesn't parse or the goal's already fully funded.
export function monthlySavingsAmount(targetAmount: number, savedAmount: number, targetDateText: string): number | null {
  const months = monthsUntil(targetDateText);
  const remaining = targetAmount - savedAmount;
  return months && remaining > 0 ? Math.ceil(remaining / months) : null;
}
