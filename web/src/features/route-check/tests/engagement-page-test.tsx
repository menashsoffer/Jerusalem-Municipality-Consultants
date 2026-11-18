import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { EngagementPage } from '../engagement-page.tsx';
import * as check from '../api/check.ts';
import * as engagement from '../api/engagement.ts';
import type { CheckResult } from '../model/result.ts';
import type { loader } from '../engagement-page.tsx';
import type { SavedRequest } from '../api/saved.ts';
type PageData = Awaited<ReturnType<typeof loader>>;

const REQUEST = '50000000-0000-4000-8000-000000000001';
const result: CheckResult = {
  id: null,
  route: 'zuta_4',
  regulation: '8(ד)(1)',
  approver: 'ועדת המכרזים',
  status: 'needs_review',
  allowed: false,
  requirements: [],
  missing: [],
  warnings: [],
  comparedValue: 120000,
  increasePercent: null,
  thresholdsSource: null,
  splittingChecked: false,
};
const supplier = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'ספק א',
  inactive: false,
  emails: ['a@x.test'],
  phones: [],
  lastApproached: '2026-10-01',
};

function page(units: PageData['units'], more: Partial<PageData> = {}) {
  const value: PageData = {
    suppliers: [supplier],
    units,
    today: '2026-11-17',
    saved: null,
    ...more,
  };
  const router = createMemoryRouter(
    [{ id: 'engagement', path: '/', Component: EngagementPage, loader: () => value }],
    { hydrationData: { loaderData: { engagement: value } } },
  );
  render(<RouterProvider router={router} />);
}
async function fill() {
  await userEvent.click(screen.getByRole('button', { name: 'המשך' }));
  await userEvent.type(screen.getByLabelText(/^אומדן בש״ח/u), '120000');
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('engagement request page', () => {
  it('checks a draft without saving when the user has no unit to save in', async () => {
    page([]);
    const run = vi.spyOn(check, 'checkRoute').mockResolvedValue(result);
    const save = vi.spyOn(engagement, 'saveRequest');
    expect(screen.getByText(/פנייה אחרונה: 01.10.2026/u)).toBeDefined();
    await fill();
    expect(screen.queryByRole('combobox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת מסלול בלבד' }));
    expect(await screen.findByRole('heading', { name: 'תוצאה' })).toBeDefined();
    expect(await screen.findByText('8(ד)(1)')).toBeDefined();
    expect(run).toHaveBeenCalledWith({
      draft: { estimated_value: 120000, value_includes_vat: false, requested_exemption: null },
      on: '2026-11-17',
    });
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /רישום פנייה/u })).toBeNull();
  });

  it('saves the request, checks it by id and then records the approach', async () => {
    page([{ id: 'u1', name: 'אגף 1' }]);
    vi.spyOn(engagement, 'saveRequest').mockResolvedValue(REQUEST);
    const run = vi.spyOn(check, 'checkRoute').mockResolvedValue({ ...result, id: 9 });
    const record = vi.spyOn(engagement, 'recordApproaches').mockResolvedValue(1);
    await fill();
    await userEvent.type(screen.getByLabelText(/^נושא/u), 'ייעוץ ארגוני');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^יחידה/u }), 'u1');
    expect(screen.getByLabelText<HTMLInputElement>(/^נושא/u).required).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת מסלול ושמירה ביחידה' }));
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalled();
    });
    expect(run).toHaveBeenCalledWith({ request_id: REQUEST, on: '2026-11-17' });
    await userEvent.click(await screen.findByRole('button', { name: 'רישום פנייה לספקים' }));
    expect(record).toHaveBeenCalledWith(REQUEST, [supplier.id]);
    expect(await screen.findByText('נרשמו 1 פניות להיום.')).toBeDefined();
  });

  it('reports a refused clipboard instead of claiming a copy', async () => {
    page([]);
    vi.spyOn(check, 'checkRoute').mockResolvedValue(result);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת מסלול בלבד' }));
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await userEvent.click(await screen.findByRole('button', { name: 'העתקת כתובות ל-BCC' }));
    expect(await screen.findByText('ההעתקה נכשלה.')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith('a@x.test');
  });

  it('goes back a step and keeps the suppliers list', async () => {
    page([]);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'לשלב הקודם' }));
    expect(screen.getByRole('heading', { name: 'הספקים' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'להמשך איתור ספקים' }).getAttribute('href')).toBe(
      '/catalog',
    );
  });

  it('points to the catalog when no supplier is picked', () => {
    page([], { suppliers: [] });
    expect(screen.getByRole('heading', { name: 'לא נבחרו ספקים לבקשה חדשה' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'בקשות שמורות' })).toBeNull();
  });

  it('lists saved requests and checks one again on another date', async () => {
    const saved: SavedRequest = {
      id: REQUEST,
      unit_id: 'u1',
      subject: 'ייעוץ ארגוני',
      estimated_value: 90000,
      value_includes_vat: true,
      requested_exemption: null,
      created_at: '2026-11-10T08:00:00Z',
      lastStatus: 'blocked',
    };
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    const run = vi.spyOn(check, 'checkRoute').mockResolvedValue(result);
    page([], { saved: [saved] });
    const table = screen.getByRole('table', { name: 'בקשות שמורות ביחידות שלך' });
    expect(table.textContent).toMatch(/10\.11\.2026/u);
    expect(table.textContent).toMatch(/המסלול חסום/u);
    await userEvent.click(screen.getByRole('button', { name: 'בדיקה מחדש: ייעוץ ארגוני' }));
    const date = screen.getByLabelText<HTMLInputElement>(/^תאריך לבדיקה/u);
    await userEvent.clear(date);
    await userEvent.type(date, '2026-12-01');
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת המסלול' }));
    expect(run).toHaveBeenCalledWith({ request_id: REQUEST, on: '2026-12-01' });
    expect(await screen.findByText('8(ד)(1)')).toBeDefined();
  });
});
