import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { EngagementPage } from '../engagement-page.tsx';
import * as check from '../api/check.ts';
import * as engagement from '../api/engagement.ts';
import type { CheckResult } from '../model/result.ts';
import type { EngagementData } from '../api/engagement.ts';

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

function page(units: EngagementData['units']) {
  const value: EngagementData = { suppliers: [supplier], units, today: '2026-11-17' };
  const router = createMemoryRouter(
    [{ id: 'engagement', path: '/', Component: EngagementPage, loader: () => value }],
    { hydrationData: { loaderData: { engagement: value } } },
  );
  render(<RouterProvider router={router} />);
}
async function fill() {
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
    expect(screen.queryByRole('combobox')).toBeNull();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת מסלול' }));
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
    await userEvent.type(screen.getByLabelText('נושא'), 'ייעוץ ארגוני');
    await fill();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /שמירה ביחידה/u }), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת מסלול' }));
    expect(run).toHaveBeenCalledWith({ request_id: REQUEST, on: '2026-11-17' });
    await userEvent.click(await screen.findByRole('button', { name: /רישום פנייה/u }));
    expect(record).toHaveBeenCalledWith(REQUEST, [supplier.id]);
    expect(await screen.findByText('נרשמו 1 פניות להיום.')).toBeDefined();
  });

  it('reports a refused clipboard instead of claiming a copy', async () => {
    page([]);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await userEvent.click(screen.getByRole('button', { name: 'העתקת כתובות ל-BCC' }));
    expect(await screen.findByText('ההעתקה נכשלה.')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith('a@x.test');
  });
});
