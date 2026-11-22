// "מה חסר לי" and the order of "המאגרים שלי" (supplier-portal-spec-he.md 6.3), without the network.
import { dayOf } from '../../../lib/dates.ts';
import type { Proposal, SupplierFile } from '../api/portal.ts';
import { validity } from './portal-model.ts';

/** The section a task card moves to; each is the id of that section's heading. */
export type TaskTarget = 'details-title' | 'requests-title' | 'registries-title';

export interface Task {
  key: string;
  text: string;
  target: TaskTarget;
}

type Membership = SupplierFile['memberships'][number];

const MAX_TASKS = 3;
const REJECTED_DAYS = 30;

/** The calendar day `days` after `day` (both YYYY-MM-DD). */
export function plusDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${String(n)} ${many}`);

function endingTask(memberships: Membership[], today: string): Task | null {
  const ending = memberships
    .filter((m) => validity(m.registered_until, today) === 'soon')
    .map((m) => m.registered_until ?? '')
    .sort();
  const [first] = ending;
  if (first === undefined) return null;
  const text =
    ending.length === 1
      ? `רישום אחד מסתיים ב-${dayOf(first)}`
      : `${String(ending.length)} רישומים מסתיימים בחודשיים הקרובים, הראשון ב-${dayOf(first)}`;
  return { key: 'ending', text, target: 'registries-title' };
}

function rejectedTask(proposals: Proposal[], today: string): Task | null {
  const since = plusDays(today, -REJECTED_DAYS);
  const n = proposals.filter(
    (p) => p.status === 'rejected' && (p.decided_at ?? '').slice(0, 10) >= since,
  ).length;
  if (n === 0) return null;
  return {
    key: 'rejected',
    text: count(n, 'בקשה אחת נדחתה', 'בקשות נדחו'),
    target: 'requests-title',
  };
}

function contactTask(file: SupplierFile): Task | null {
  const has = (kind: string) => file.contacts.some((c) => c.kind === kind);
  const phone = has('phone');
  const email = has('email');
  if (phone && email) return null;
  const text =
    !phone && !email
      ? 'חסרים טלפון ודוא"ל ליצירת קשר'
      : phone
        ? 'חסר דוא"ל ליצירת קשר'
        : 'חסר טלפון ליצירת קשר';
  return { key: 'contact', text, target: 'details-title' };
}

function pendingTask(proposals: Proposal[]): Task | null {
  const n = proposals.filter((p) => p.status === 'pending').length;
  if (n === 0) return null;
  const text = count(n, 'תיקון אחד ממתין לבדיקת העירייה', 'תיקונים ממתינים לבדיקת העירייה');
  return { key: 'pending', text, target: 'requests-title' };
}

/** Up to three things the supplier should look at, most urgent first; empty when all is well. */
export function missingTasks(file: SupplierFile, proposals: Proposal[], today: string): Task[] {
  const tasks = [
    endingTask(file.memberships, today),
    rejectedTask(proposals, today),
    contactTask(file),
    pendingTask(proposals),
  ];
  return tasks.filter((t): t is Task => t !== null).slice(0, MAX_TASKS);
}

const ORDER: Record<ReturnType<typeof validity>, number> = { soon: 0, valid: 1, open: 1, ended: 2 };

/** Registrations ending soon first, then the current ones, and the ended ones last. */
export function orderedMemberships(memberships: Membership[], today: string): Membership[] {
  return memberships
    .map((m, index) => ({ m, index, rank: ORDER[validity(m.registered_until, today)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ m }) => m);
}
