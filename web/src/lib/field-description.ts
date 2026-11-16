export interface FieldLabel {
  label: string;
  hint?: string;
  error?: string;
}
export function describedBy(id: string, parts: { hint?: string; error?: string; extra?: string }) {
  const values = [parts.extra, parts.hint ? `${id}-hint` : '', parts.error ? `${id}-error` : ''];
  return values.filter(Boolean).join(' ') || undefined;
}
