import type { Proposal, Threshold } from '../api/proposals.ts';
export const AMOUNT_LABELS = {
  no_tender_max: 'ללא מכרז',
  zuta4_max: 'מכרז זוטא — ארבע הצעות',
  zuta6_max: 'מכרז זוטא — שש הצעות',
} as const;
export function previousThreshold(proposal: Proposal, thresholds: Threshold[]): Threshold | null {
  const before = new Date(`${proposal.valid_from}T00:00:00Z`);
  before.setUTCDate(before.getUTCDate() - 1);
  const day = before.toISOString().slice(0, 10);
  return (
    thresholds
      .filter((t) => t.valid_from <= day && (t.valid_until === null || t.valid_until >= day))
      .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] ?? null
  );
}
const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });
export function formatMoney(amount: number): string {
  return money.format(amount);
}
export function monthLabel(date: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
