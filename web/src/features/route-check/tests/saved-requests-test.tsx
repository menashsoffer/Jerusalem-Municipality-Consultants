// Editing and cancelling a saved request from the saved-requests table.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DataError } from '../../../data/client.ts';
import { RULE_MESSAGES } from '../../../lib/rules/messages.ts';
import * as saved from '../api/saved.ts';
import type { SavedRequest } from '../api/saved.ts';
import { ReloadSavedProvider } from '../components/saved-list.tsx';
import { SavedRequests } from '../components/saved-requests.tsx';

const REQUEST: SavedRequest = {
  id: '50000000-0000-4000-8000-000000000001',
  unit_id: 'u1',
  subject: 'ייעוץ ארגוני',
  estimated_value: 90000,
  value_includes_vat: true,
  requested_exemption: null,
  status: 'draft',
  created_at: '2026-11-10T08:00:00Z',
  updated_at: '2026-11-11T08:00:00Z',
  lastStatus: 'ok',
  changedSinceCheck: true,
};

function show(requests: SavedRequest[]) {
  const loader = vi.fn(() => null);
  const reload = vi.fn(() => Promise.resolve());
  const Page = () => (
    <ReloadSavedProvider value={reload}>
      <SavedRequests requests={requests} units={new Map([['u1', 'רכש']])} today="2026-11-18" />
    </ReloadSavedProvider>
  );
  const router = createMemoryRouter([{ id: 'saved', path: '/', Component: Page, loader }], {
    hydrationData: { loaderData: { saved: null } },
  });
  render(<RouterProvider router={router} />);
  return reload;
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('saved requests', () => {
  it('says when the details changed after the last check', () => {
    show([REQUEST]);
    const table = screen.getByRole('table');
    expect(table.textContent).toMatch(/הפרטים שונו מאז, כדאי לבדוק שוב/u);
  });

  it('saves edited details and reloads the list', async () => {
    const update = vi.spyOn(saved, 'updateRequest').mockResolvedValue();
    const reload = show([REQUEST]);
    await userEvent.click(screen.getByRole('button', { name: 'עריכת הבקשה: ייעוץ ארגוני' }));
    const form = screen.getByRole('form', { name: 'עריכת הבקשה' });
    const value = within(form).getByLabelText<HTMLInputElement>(/^אומדן בש״ח/u);
    expect(value.value).toBe('90000');
    await userEvent.clear(value);
    await userEvent.type(value, '75,000');
    await userEvent.type(within(form).getByLabelText(/^פטור מבוקש/u), '3(8)');
    await userEvent.click(within(form).getByRole('button', { name: 'שמירת השינויים' }));
    expect(update).toHaveBeenCalledWith(REQUEST.id, {
      subject: 'ייעוץ ארגוני',
      estimated_value: 75000,
      value_includes_vat: true,
      requested_exemption: '3(8)',
    });
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
  });

  it('says when the list could not be fetched again after a change', () => {
    render(<SavedRequests requests={[REQUEST]} stale units={new Map()} today="2026-11-18" />);
    expect(screen.getByText('הרשימה לא התעדכנה.')).toBeDefined();
  });

  it('shows why the database refused an edit', async () => {
    const refused = new DataError(400, RULE_MESSAGES.request_closed);
    vi.spyOn(saved, 'updateRequest').mockRejectedValue(refused);
    show([REQUEST]);
    await userEvent.click(screen.getByRole('button', { name: 'עריכת הבקשה: ייעוץ ארגוני' }));
    await userEvent.click(screen.getByRole('button', { name: 'שמירת השינויים' }));
    expect(await screen.findByText(RULE_MESSAGES.request_closed)).toBeDefined();
  });

  it('cancels a request only with a reason', async () => {
    const cancel = vi.spyOn(saved, 'cancelRequest').mockResolvedValue();
    const reload = show([REQUEST]);
    await userEvent.click(screen.getByRole('button', { name: 'ביטול הבקשה: ייעוץ ארגוני' }));
    const form = screen.getByRole('form', { name: 'ביטול הבקשה' });
    await userEvent.click(within(form).getByRole('button', { name: 'ביטול הבקשה' }));
    expect(cancel).not.toHaveBeenCalled();
    expect(await within(form).findByText(RULE_MESSAGES.required)).toBeDefined();
    await userEvent.type(within(form).getByLabelText(/^סיבת הביטול/u), ' הצורך בוטל ');
    await userEvent.click(within(form).getByRole('button', { name: 'ביטול הבקשה' }));
    expect(cancel).toHaveBeenCalledWith(REQUEST.id, 'הצורך בוטל');
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
  });

  it('offers no edit for an approved request, only a check and a cancel', () => {
    show([{ ...REQUEST, status: 'approved' }]);
    expect(screen.queryByRole('button', { name: /^עריכת הבקשה/u })).toBeNull();
    expect(screen.getByRole('button', { name: 'ביטול הבקשה: ייעוץ ארגוני' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'בדיקה מחדש: ייעוץ ארגוני' })).toBeDefined();
  });
});
