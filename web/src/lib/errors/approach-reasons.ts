// Refusals about approaches and answers (supplier-approaches-spec-he.md 7.4). The screens that
// record or answer approaches import this, so the main bundle does not carry the texts.
import { registerReasons } from './reasons.ts';

export const APPROACH_REASONS = {
  approach_closed: 'המועד לתשובה עבר, או שהבקשה בוטלה. אי אפשר לענות או לשנות עכשיו.',
  approach_answered: 'כבר יש תשובה לפנייה. כדי לשנות, בטלו קודם את התשובה הקודמת.',
  approach_deadline: 'בחרו מועד מחר ועד 90 יום, ולא מוקדם מהמועד הקיים.',
  approach_amount: 'כתבו סכום חיובי עם עד שתי ספרות אחרי הנקודה, ובחרו אם הוא כולל מע״מ.',
} as const;

registerReasons(APPROACH_REASONS);
