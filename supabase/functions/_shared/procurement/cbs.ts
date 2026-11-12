import { thresholdValidUntil, thresholdsFromIndex, type Thresholds } from './amounts.ts';

/** Calculate a monthly update from one CPI observation on the 1985 average base. */
export function thresholdsFromCbs(index: number, year: number, month: number): Thresholds {
  if (
    !Number.isFinite(index) ||
    index <= 0 ||
    !Number.isInteger(year) ||
    year < 1985 ||
    year > 9999
  ) {
    throw new Error('Invalid CPI observation');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid CPI month');
  }
  // CPI for a month is normally published on the 15th of the following month.
  const from = new Date(Date.UTC(year, month, 16)).toISOString().slice(0, 10);
  const observation = `${String(year)}-${String(month).padStart(2, '0')}`;
  const url = 'https://api.cbs.gov.il/index/data/price?id=120010';
  return thresholdsFromIndex(index, from, `CBS CPI ${observation}; ${url}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected CBS response');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (value === null) throw new Error('CBS observation is missing or not yet published');
  if (!Array.isArray(value)) throw new Error('Unexpected CBS response');
  return value as unknown[];
}

/** Extract exactly the requested CPI observation, using CBS's 1985 linking coefficients. */
export function cbsIndex(response: unknown, year: number, month: number): number {
  const series = asArray(asRecord(response).month).map(asRecord);
  const cpi = series.filter((item) => item.code === 120010);
  if (cpi.length !== 1) throw new Error('CBS CPI series is missing or ambiguous');
  const observations = asArray(cpi[0]?.date).map(asRecord);
  const matches = observations.filter((item) => item.year === year && item.month === month);
  if (matches.length !== 1) throw new Error('CBS observation is missing or ambiguous');
  const bases = asArray(matches[0]?.prevBase).map(asRecord);
  const base = bases.filter((item) => item.baseDesc === '1985 ממוצע');
  const index = base[0]?.value;
  if (base.length !== 1 || typeof index !== 'number' || !Number.isFinite(index) || index <= 0) {
    throw new Error('CBS 1985-base index is missing or invalid');
  }
  return index;
}

/** Produce a reviewable migration without applying it to a database. */
export function thresholdInsert(index: number, year: number, month: number): string {
  if (index >= 1_000_000) throw new Error('CBS index exceeds database precision');
  const roundedIndex = Number(index.toFixed(4));
  const exact = thresholdsFromCbs(index, year, month);
  const stored = thresholdsFromCbs(roundedIndex, year, month);
  if (
    exact.noTenderMax !== stored.noTenderMax ||
    exact.zuta4Max !== stored.zuta4Max ||
    exact.zuta6Max !== stored.zuta6Max
  ) {
    throw new Error('Database index precision changes a threshold; manual review required');
  }
  return (
    `insert into public.thresholds
  (valid_from, valid_until, no_tender_max, zuta4_max, zuta6_max, index_value, source, is_official)
values ('${stored.effectiveFrom}', '${thresholdValidUntil(stored)}', ${String(stored.noTenderMax)}, ` +
    `${String(stored.zuta4Max)}, ${String(stored.zuta6Max)}, ${String(roundedIndex)},\n` +
    `  '${stored.source}', false);`
  );
}
