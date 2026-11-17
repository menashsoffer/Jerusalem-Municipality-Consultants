import type { Draft } from './result.ts';

export interface DraftFields {
  draft: Draft;
  unitId: string;
  subject: string;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** Reads the request form. Returns a Hebrew message when a field cannot be used. */
export function readDraft(form: FormData): DraftFields | string {
  const amount = Number(text(form, 'estimated_value').replaceAll(',', ''));
  if (!text(form, 'estimated_value') || !Number.isFinite(amount) || amount < 0) {
    return 'יש להזין אומדן כמספר שאינו שלילי.';
  }
  const exemption = text(form, 'requested_exemption');
  if (exemption && !/^3\([0-9]+א?\)$/u.test(exemption)) {
    return 'פטור מבוקש נכתב כמו 3(8) או 3(29א).';
  }
  const unitId = text(form, 'unit_id');
  const subject = text(form, 'subject');
  if (unitId && subject.length < 3) return 'כדי לשמור בקשה יש לכתוב נושא של 3 תווים לפחות.';
  const draft = {
    estimated_value: amount,
    value_includes_vat: form.get('value_includes_vat') === 'on',
    requested_exemption: exemption || null,
  };
  return { draft, unitId, subject };
}
