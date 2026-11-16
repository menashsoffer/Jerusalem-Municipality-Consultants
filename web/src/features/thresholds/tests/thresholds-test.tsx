import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThresholdsPage } from '../thresholds-page.tsx';
import * as api from '../api/proposals.ts';
import { DataError } from '../../../data/client.ts';
const proposal: api.Proposal = {
  id: 'proposal-1',
  valid_from: '2026-11-16',
  index_value: 120,
  no_tender_max: 100000,
  zuta4_max: 200000,
  zuta6_max: 300000,
  source: 'פרסום הלמ״ס לדוגמה',
  status: 'pending',
};
const threshold: api.Threshold = {
  ...proposal,
  id: 'old',
  valid_from: '2026-10-16',
  valid_until: '2026-11-15',
  is_official: false,
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function page(proposals: api.Proposal[] = [proposal]) {
  const data = { proposals, thresholds: [threshold] };
  const router = createMemoryRouter(
    [{ path: '/', Component: ThresholdsPage, loader: () => data }],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return data;
}
describe('monthly threshold decisions', () => {
  it('shows the source and previous-month comparison', async () => {
    page();
    expect(await screen.findByRole('table', { name: /השוואת הספים/ })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /אוקטובר/ })).toBeDefined();
    expect(screen.getByText(/מקור המדד: פרסום הלמ״ס/)).toBeDefined();
  });
  it('waits for approval, prevents duplicate submission, then removes the approved proposal', async () => {
    const data = page();
    let complete: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      complete = () => {
        data.proposals = [];
        resolve();
      };
    });
    const decide = vi.spyOn(api, 'decideProposal').mockReturnValue(pending);
    const approve = await screen.findByRole('button', { name: 'אישור הסף החודשי' });
    await userEvent.click(approve);
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('table')).toBeDefined();
    expect(decide).toHaveBeenCalledWith('proposal-1', true);
    complete();
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
  });
  it('keeps a rejected request error visible and leaves the proposal available', async () => {
    page();
    vi.spyOn(api, 'decideProposal').mockRejectedValue(new DataError(403));
    await userEvent.click(await screen.findByRole('button', { name: 'דחיית ההצעה' }));
    expect((await screen.findByRole('alert')).textContent).toContain('אין לך הרשאה');
    expect(screen.getByRole('table')).toBeDefined();
  });
  it('refreshes and explains when another admin already decided the proposal', async () => {
    const data = page();
    vi.spyOn(api, 'decideProposal').mockImplementation(() => {
      data.proposals = [];
      return Promise.reject(new DataError(404));
    });
    await userEvent.click(await screen.findByRole('button', { name: 'אישור הסף החודשי' }));
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
  });
  it('rejects through the same RPC and refreshes after server confirmation', async () => {
    const data = page();
    const decide = vi.spyOn(api, 'decideProposal').mockImplementation(() => {
      data.proposals = [];
      return Promise.resolve();
    });
    await userEvent.click(await screen.findByRole('button', { name: 'דחיית ההצעה' }));
    await waitFor(() => {
      expect(decide).toHaveBeenCalledWith('proposal-1', false);
    });
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
  });
  it('shows a meaningful empty state', async () => {
    page([]);
    expect(await screen.findByRole('heading', { name: 'אין הצעות ממתינות' })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
