import { thresholdsFromIndex, type Thresholds } from './amounts.ts';

/** Calculate a monthly update from one CPI observation on the 1985 average base. */
export function thresholdsFromCbs(index: number, year: number, month: number): Thresholds {
  if (!Number.isFinite(index) || index <= 0 || !Number.isInteger(year) || year < 1985) {
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
