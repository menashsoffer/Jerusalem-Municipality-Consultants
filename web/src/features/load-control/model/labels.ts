const JOB_STATUS: Record<string, string> = { running: 'רץ', ok: 'הצליח', failed: 'נכשל' };
const REGISTRY_STATUS: Record<string, string> = {
  active: 'פעיל',
  closed: 'סגור',
  unknown: 'לא ידוע',
};
const SOURCES: Record<string, string> = {
  companies_registrar: 'רשם החברות',
  guidestar: 'גיידסטאר',
};

export function jobStatus(status: string): string {
  return JOB_STATUS[status] ?? status;
}
export function registryStatus(status: string): string {
  return REGISTRY_STATUS[status] ?? status;
}
export function sourceLabel(source: string): string {
  return SOURCES[source] ?? source;
}

/** A timestamp shown in Jerusalem time, or a dash when it is missing. */
export function when(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
