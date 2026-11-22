// Refusals staff can meet when recording approaches (supplier-approaches-spec-he.md 7.4).
// Kept in this screen, so the first load carries no approach texts.
import { registerReasons } from '../../../lib/errors/reasons.ts';

export const STAFF_APPROACH_REASONS = {
  approach_closed: 'הבקשה בוטלה, או שהמועד לתשובה כבר עבר. אי אפשר לשנות את הפניות שלה.',
  approach_deadline: 'בחרו מועד מחר ועד 90 יום, ולא מוקדם מהמועד הקיים.',
} as const;

registerReasons(STAFF_APPROACH_REASONS);
