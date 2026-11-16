import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentifiersPage } from '../identifiers-page.tsx';
import * as api from '../api/candidates.ts';
import { DataError } from '../../../data/client.ts';
function data(): Awaited<ReturnType<typeof api.loadCandidates>> {
  return {
    candidates: [
      {
        id: 'candidate',
        supplier_id: 'supplier',
        scheme: 'company',
        value: '512345678',
        source: 'companies_registrar',
        registrar_name: 'יועצי העיר',
        registrar_status: 'פעילה',
        searched_name: 'יועצי העיר',
        found_at: '2026-11-16',
      },
    ],
    suppliers: [{ id: 'supplier', display_name: 'יועצי העיר' }],
  };
}
function page(value = data()) {
  const router = createMemoryRouter([
    { path: '/', Component: IdentifiersPage, loader: () => value },
  ]);
  render(<RouterProvider router={router} />);
  return value;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('manual identifier candidates', () => {
  it('shows the source and comparison without making an automatic decision', async () => {
    const decide = vi.spyOn(api, 'decideCandidate');
    page();
    expect(await screen.findByRole('table', { name: 'השוואת השמות' })).toBeDefined();
    expect(screen.getByText(/זהו רמז בלבד/)).toBeDefined();
    expect(screen.getByText('מקור המועמד: רשם החברות')).toBeDefined();
    expect(screen.getByText(/ממתין לאימות של אדם נוסף/)).toBeDefined();
    expect(decide).not.toHaveBeenCalled();
  });
  it('keeps the candidate until manual acceptance succeeds', async () => {
    const value = page();
    let finish: () => void = () => undefined;
    const decide = vi.spyOn(api, 'decideCandidate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            value.candidates = [];
            resolve();
          };
        }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'קבלת המועמד לבדיקה נוספת' }));
    expect(screen.getByRole('table')).toBeDefined();
    finish();
    expect(await screen.findByRole('heading', { name: 'אין מועמדים ממתינים' })).toBeDefined();
    expect(decide).toHaveBeenCalledWith('candidate', true);
  });
  it('dismisses only by an explicit decision', async () => {
    const value = page();
    const decide = vi.spyOn(api, 'decideCandidate').mockImplementation(() => {
      value.candidates = [];
      return Promise.resolve();
    });
    await userEvent.click(await screen.findByRole('button', { name: 'דחיית המועמד' }));
    expect(await screen.findByRole('heading', { name: 'אין מועמדים ממתינים' })).toBeDefined();
    expect(decide).toHaveBeenCalledWith('candidate', false);
  });
  it('keeps evidence visible on server rejection', async () => {
    page();
    vi.spyOn(api, 'decideCandidate').mockRejectedValue(new DataError(403));
    await userEvent.click(await screen.findByRole('button', { name: 'דחיית המועמד' }));
    expect((await screen.findByRole('alert')).textContent).toContain('אין לך הרשאה');
    expect(screen.getByRole('table')).toBeDefined();
  });
});
