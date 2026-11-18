import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThresholdsPage } from '../thresholds-page.tsx';
import * as api from '../api/proposals.ts';
import * as dates from '../../../lib/dates.ts';
import { DataError } from '../../../data/client.ts';
const proposal: api.Proposal = {
  id: 'proposal-1',
  valid_from: '2026-11-16',
  index_value: 120,
  no_tender_max: 100400,
  zuta4_max: 200000,
  zuta6_max: 300000,
  source: 'https://www.cbs.gov.il/index',
  status: 'pending',
};
const threshold: api.Threshold = {
  ...proposal,
  id: 'old',
  no_tender_max: 100000,
  source: 'הלמ״ס',
  valid_from: '2026-10-16',
  valid_until: '2026-11-15',
  is_official: false,
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function page(proposals: api.Proposal[] = [proposal], thresholds = [threshold]) {
  vi.spyOn(dates, 'israelToday').mockReturnValue('2026-11-10');
  const data = { proposals, thresholds };
  const router = createMemoryRouter(
    [{ path: '/', Component: ThresholdsPage, loader: () => data }],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return data;
}
async function approveDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'אישור הספים' }));
  return screen.getByRole('form', { name: 'אישור הספים מ-16.11.2026' });
}
describe('monthly threshold decisions', () => {
  it('shows the thresholds in force today and how much each proposed one changes', async () => {
    page();
    const current = await screen.findByRole('region', { name: 'הספים בתוקף היום' });
    expect(within(current).getByText('בתוקף מ-16.10.2026')).toBeDefined();
    expect(within(current).getByText('חישוב פנימי, לא פורסם רשמית')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'הצעה לספים מ-16.11.2026' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'מקור המדד' })).toBeDefined();
    const table = screen.getByRole('table', { name: /השוואת הספים/ });
    expect(within(table).getByText(/\+0\.4%/)).toBeDefined();
  });
  it('says when no thresholds are in force and no proposal waits', async () => {
    page([], []);
    expect(await screen.findByText(/אין ספים בתוקף היום/)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('approves only from the dialog that repeats the amounts', async () => {
    const data = page();
    const decide = vi.spyOn(api, 'decideProposal').mockImplementation(() => {
      data.proposals = [];
      return Promise.resolve();
    });
    const form = await approveDialog();
    expect(within(form).getByText(/100,400/)).toBeDefined();
    expect(decide).not.toHaveBeenCalled();
    await userEvent.click(within(form).getByRole('button', { name: 'אישור הספים' }));
    expect(decide).toHaveBeenCalledWith('proposal-1', true);
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
  });
  it('keeps an error in the dialog and the proposal on screen', async () => {
    page();
    vi.spyOn(api, 'decideProposal').mockRejectedValue(new DataError(403));
    const form = await approveDialog();
    await userEvent.click(within(form).getByRole('button', { name: 'אישור הספים' }));
    expect((await within(form).findByRole('alert')).textContent).toContain('אין לך הרשאה');
    expect(screen.getByRole('table')).toBeDefined();
  });
  it('refreshes when another admin already decided the proposal', async () => {
    const data = page();
    vi.spyOn(api, 'decideProposal').mockImplementation(() => {
      data.proposals = [];
      return Promise.reject(new DataError(404));
    });
    const form = await approveDialog();
    await userEvent.click(within(form).getByRole('button', { name: 'אישור הספים' }));
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
  });
  it('rejects after confirmation and refreshes', async () => {
    const data = page();
    const decide = vi.spyOn(api, 'decideProposal').mockImplementation(() => {
      data.proposals = [];
      return Promise.resolve();
    });
    await userEvent.click(await screen.findByRole('button', { name: 'דחייה' }));
    await userEvent.click(screen.getByRole('button', { name: 'דחיית ההצעה' }));
    expect(decide).toHaveBeenCalledWith('proposal-1', false);
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
  });
  it('shows a failed rejection inside the confirmation', async () => {
    page();
    vi.spyOn(api, 'decideProposal').mockRejectedValue(new Error('network'));
    await userEvent.click(await screen.findByRole('button', { name: 'דחייה' }));
    await userEvent.click(screen.getByRole('button', { name: 'דחיית ההצעה' }));
    expect(await screen.findByText('לא ניתן לשמור את ההחלטה.')).toBeDefined();
  });
});
