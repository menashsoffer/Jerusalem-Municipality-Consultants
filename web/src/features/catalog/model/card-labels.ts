import type { Membership, Supplier } from '../../../catalog-model.ts';

/** Contact values load with the supplier's details, so the card only says what exists. */
export function contactSummary(kinds: string[]): string {
  const found = [kinds.includes('phone') && 'טלפון', kinds.includes('email') && 'דוא״ל'];
  const labels = found.filter((label): label is string => typeof label === 'string');
  return labels.length ? `יש במאגר: ${labels.join(' ו')}` : 'אין טלפון או דוא״ל במאגר';
}

export type BadgeTone = 'success' | 'warning' | 'neutral' | 'danger';
export interface Badge {
  tone: BadgeTone;
  text: string;
}
const IDENTIFIER: Record<string, Badge> = {
  verified: { tone: 'success', text: 'ח.פ. מאושר' },
  pending: { tone: 'warning', text: 'ח.פ. ממתין לאישור' },
};
const NO_IDENTIFIER: Badge = { tone: 'neutral', text: 'אין ח.פ. מאושר' };

/** Three separate questions, so a missing number never reads as an inactive supplier. */
export function supplierBadges(supplier: Pick<Supplier, 'identifier' | 'inactive'>): Badge[] {
  const badges = [IDENTIFIER[supplier.identifier ?? ''] ?? NO_IDENTIFIER];
  if (supplier.inactive) badges.push({ tone: 'danger', text: 'לא פעיל' });
  return badges;
}

export function inactiveLine(inactive: NonNullable<Supplier['inactive']>): string {
  const parts = [`סיבה: ${inactive.reason}`];
  if (inactive.source) parts.push(`מקור: ${inactive.source}`);
  if (inactive.changedOn) parts.push(`מתאריך ${inactive.changedOn}`);
  return parts.join(' · ');
}

export function membershipState(member: Pick<Membership, 'reviewStatus' | 'registryClosed'>) {
  return [
    member.registryClosed ? 'מאגר סגור' : '',
    member.reviewStatus === 'verified' ? '' : 'בבדיקה',
  ].filter(Boolean);
}

export type VenueIcon = 'seats' | 'size' | 'stage' | 'screen' | 'sound' | 'lighting';
export interface VenueFact {
  icon: VenueIcon | null;
  text: string;
}
const VENUE_LABELS: [VenueIcon, keyof NonNullable<Supplier['venue']>, string][] = [
  ['seats', 'capacity_text', 'קיבולת'],
  ['size', 'hall_size', 'גודל אולם'],
  ['stage', 'stage_size', 'במה'],
  ['screen', 'screen', 'מסך'],
  ['sound', 'sound', 'הגברה'],
  ['lighting', 'lighting', 'תאורה'],
];

/** Each published hall detail with its own text label; empty fields are left out. */
export function venueFacts(venue: Supplier['venue']): VenueFact[] {
  if (!venue) return [];
  const facts = VENUE_LABELS.flatMap(([icon, key, label]): VenueFact[] => {
    const value = venue[key];
    return value === null || value === '' ? [] : [{ icon, text: `${label}: ${String(value)}` }];
  });
  return venue.survey_year === null
    ? facts
    : [...facts, { icon: null, text: `לפי מאגר ${String(venue.survey_year)}` }];
}
