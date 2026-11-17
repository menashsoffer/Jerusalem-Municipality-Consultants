import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CatalogBrowser } from '../components/catalog-browser.tsx';
import { Results } from '../components/results.tsx';
import { filterCatalog, type Filters } from '../../../catalog-filter.ts';
import { state, suppliers } from './fixture.ts';
import { emptyFilters } from '../model/filters.ts';
import { replaceShortlist, shortlistIds } from '../../../lib/shortlist.ts';
const TODAY = '2026-11-16';
function page() {
  const value = state();
  render(
    <MemoryRouter>
      <CatalogBrowser state={value} today={TODAY} />
    </MemoryRouter>,
  );
  return value;
}
afterEach(cleanup);
function detailLinks() {
  return screen
    .queryAllByRole('link', { name: /^פרטי ספק:/ })
    .map((link) => link.getAttribute('href'));
}
async function matchesLegacy(filters: Filters) {
  const expected = filterCatalog(suppliers(), filters).map(
    (s) => `/supplier/${encodeURIComponent(s.id)}`,
  );
  await waitFor(() => {
    expect(detailLinks()).toEqual(expected);
  });
}
describe('React catalog parity', () => {
  it('searches former names through the same normalized model', async () => {
    page();
    await userEvent.type(screen.getByRole('searchbox', { name: 'חיפוש ספקים' }), 'שם קודם');
    await matchesLegacy({ ...emptyFilters(TODAY), query: 'שם קודם' });
    expect(screen.getByRole('link', { name: 'פרטי ספק: שם נוכחי' })).toBeDefined();
  });
  it('applies registry, field, root, child, unit and validity filters and resets dependencies', async () => {
    page();
    await userEvent.click(screen.getByText('סינון תוצאות'));
    const selected = {
      ...emptyFilters(TODAY),
      registry: 'r1',
      field: 'f1',
      category: 'root',
      subcategory: 'c1',
      unit: 'u1',
      validity: 'valid' as const,
    };
    for (const [label, value] of [
      ['מאגר', 'r1'],
      ['תחום', 'f1'],
      ['קטגוריה', 'root'],
      ['תת־קטגוריה', 'c1'],
      ['יחידה', 'u1'],
      ['תוקף', 'valid'],
    ] as const) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: label }), value);
    }
    await matchesLegacy(selected);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'מאגר' }), 'r2');
    await matchesLegacy({ ...emptyFilters(TODAY), registry: 'r2', validity: 'valid' });
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'תחום' }).value).toBe('');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'תת־קטגוריה' }).disabled).toBe(
      true,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'תוקף' }), 'expired');
    await matchesLegacy({ ...emptyFilters(TODAY), registry: 'r2', validity: 'expired' });
  });
  it('shows an empty result and clears both search and filters', async () => {
    page();
    await userEvent.type(screen.getByRole('searchbox', { name: 'חיפוש ספקים' }), 'לא קיים');
    expect(await screen.findByRole('heading', { name: 'לא נמצאו ספקים' })).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'ניקוי החיפוש והמסננים' }));
    await matchesLegacy(emptyFilters(TODAY));
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
  });
  it('renders all progressive batches and retains keyboard links below the first batch', async () => {
    const [first] = suppliers();
    if (!first) throw Error('missing fixture');
    const many = Array.from({ length: 250 }, (_, i) => ({
      ...first,
      id: String(i),
      name: `ספק ${String(i)}`,
    }));
    render(
      <MemoryRouter>
        <Results suppliers={many} today={TODAY} />
      </MemoryRouter>,
    );
    expect(detailLinks()).toHaveLength(100);
    await waitFor(() => {
      expect(detailLinks()).toHaveLength(250);
    });
    expect(screen.getByRole('list', { name: 'ספקים' }).getAttribute('aria-busy')).toBe('false');
    expect(screen.getByRole('link', { name: 'פרטי ספק: ספק 249' }).getAttribute('href')).toBe(
      '/supplier/249',
    );
  });
  it('adds a supplier to the request and never an inactive one', async () => {
    const [first] = suppliers();
    if (!first) throw Error('missing fixture');
    const active = { ...first, id: '10000000-0000-4000-8000-0000000000a1', name: 'פעיל' };
    const inactive = {
      ...first,
      id: '10000000-0000-4000-8000-0000000000a2',
      name: 'לא פעיל',
      inactive: { reason: 'מונתה לשופטת', source: null, changedOn: '2026-09-01' },
    };
    replaceShortlist([]);
    render(
      <MemoryRouter>
        <Results suppliers={[active, inactive]} today={TODAY} />
      </MemoryRouter>,
    );
    const add = screen.getByRole('button', { name: 'בקשת התקשרות: פעיל' });
    expect(add.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(add);
    expect(add.getAttribute('aria-pressed')).toBe('true');
    expect(shortlistIds()).toEqual([active.id]);
    const blocked = screen.getByRole<HTMLButtonElement>('button', {
      name: 'הוספה לבקשת התקשרות',
    });
    expect(blocked.disabled).toBe(true);
    replaceShortlist([]);
  });
});
