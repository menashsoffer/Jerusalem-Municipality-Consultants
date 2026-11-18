import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RouteCheckPage } from '../route-check-page.tsx';
import * as api from '../api/check.ts';
import { DataError } from '../../../data/client.ts';
import type { CheckResult } from '../model/result.ts';
const request = {
  id: '10000000-0000-4000-8000-000000000001',
  unit_id: 'unit',
  subject: 'ייעוץ לתכנון',
  estimated_value: 200,
  value_includes_vat: false,
  requested_exemption: null,
};
const result: CheckResult = {
  id: 1,
  route: 'zuta_4',
  regulation: '8(ד)(1)',
  approver: 'ועדת המכרזים',
  status: 'needs_review',
  allowed: false,
  requirements: ['יש לפנות לארבעה ספקים'],
  missing: ['נדרשת בדיקה ידנית'],
  warnings: ['הסף מחושב'],
  comparedValue: 200,
  increasePercent: null,
  thresholdsSource: 'פרסום משרד הפנים',
  splittingChecked: false,
};
function page(requests = [request]) {
  const value = { requests, units: [{ id: 'unit', name: 'יחידה א' }], today: '2026-11-16' };
  const router = createMemoryRouter(
    [{ id: 'route-check', path: '/', Component: RouteCheckPage, loader: () => value }],
    { hydrationData: { loaderData: { 'route-check': value } } },
  );
  render(<RouterProvider router={router} />);
}
async function review() {
  await userEvent.selectOptions(
    await screen.findByRole('combobox', { name: 'בקשת התקשרות' }),
    request.id,
  );
  await userEvent.click(screen.getByRole('button', { name: 'המשך לבדיקת הנתונים' }));
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('route-check wizard', () => {
  it('keeps the selected request and date when returning to the first step', async () => {
    page();
    await review();
    const date = screen.getByLabelText(/^תאריך לבדיקה/u);
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-17');
    await userEvent.click(screen.getByRole('button', { name: 'חזרה לבחירת בקשה' }));
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(request.id);
    await userEvent.click(screen.getByRole('button', { name: 'המשך לבדיקת הנתונים' }));
    expect(screen.getByLabelText<HTMLInputElement>(/^תאריך לבדיקה/u).value).toBe('2026-11-17');
  });
  it('waits for the server and renders the citation, requirements and review warning', async () => {
    page();
    await review();
    let finish: (value: CheckResult) => void = () => undefined;
    vi.spyOn(api, 'checkRoute').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת המסלול' }));
    expect(screen.queryByRole('heading', { name: 'תוצאת הבדיקה' })).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'חזרה לבחירת בקשה' }).disabled,
    ).toBe(true);
    finish(result);
    expect(await screen.findByText('8(ד)(1)')).toBeDefined();
    expect(screen.getByText('נדרשת בדיקה נוספת')).toBeDefined();
    expect(screen.getByText('יש לפנות לארבעה ספקים')).toBeDefined();
    expect(screen.getByText('הסף מחושב')).toBeDefined();
    expect(screen.queryByText('התנאים שנבדקו מתקיימים')).toBeNull();
  });
  it('announces forbidden responses without losing the review form', async () => {
    page();
    await review();
    vi.spyOn(api, 'checkRoute').mockRejectedValue(new DataError(403));
    await userEvent.click(screen.getByRole('button', { name: 'בדיקת המסלול' }));
    expect((await screen.findByRole('alert')).textContent).toContain('אין לך הרשאה');
    expect(screen.getByLabelText(/^תאריך לבדיקה/u)).toBeDefined();
  });
  it('shows the empty state without a selection form', async () => {
    page([]);
    expect(await screen.findByRole('heading', { name: 'אין בקשות זמינות לבדיקה' })).toBeDefined();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
