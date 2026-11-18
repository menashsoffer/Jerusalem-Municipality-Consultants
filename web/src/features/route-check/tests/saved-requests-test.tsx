// Editing and cancelling a saved request from the saved-requests table.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DataError } from '../../../data/client.ts';
import { RULE_MESSAGES } from '../../../lib/rules/messages.ts';
import * as saved from '../api/saved.ts';
import type { SavedRequest } from '../api/saved.ts';
import * as rpc from '../../../data/rpc.ts';
import * as screenData from '../../../data/screen-data.ts';
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
  const Page = () => (
    <SavedRequests requests={requests} units={new Map([['u1', 'רכש']])} today="2026-11-18" />
  );
  const router = createMemoryRouter([{ id: 'saved', path: '/', Component: Page, loader }], {
    hydrationData: { loaderData: { saved: null } },
  });
  render(<RouterProvider router={router} />);
}

/** The real write functions run against a stubbed database; the list key must be marked. */
function stubWrites() {
  const call = vi.spyOn(rpc, 'rpc').mockResolvedValue(null);
  const changed = vi.spyOn(screenData, 'invalidate').mockResolvedValue();
  return { call, changed };
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
    const { call, changed } = stubWrites();
    show([REQUEST]);
    await userEvent.click(screen.getByRole('button', { name: 'עריכת הבקשה: ייעוץ ארגוני' }));
    const form = screen.getByRole('form', { name: 'עריכת הבקשה' });
    const value = within(form).getByLabelText<HTMLInputElement>(/^אומדן בש״ח/u);
    expect(value.value).toBe('90000');
    await userEvent.clear(value);
    await userEvent.type(value, '75,000');
    await userEvent.type(within(form).getByLabelText(/^פטור מבוקש/u), '3(8)');
    await userEvent.click(within(form).getByRole('button', { name: 'שמירת השינויים' }));
    const draft = {
      subject: 'ייעוץ ארגוני',
      estimated_value: 75000,
      value_includes_vat: true,
      requested_exemption: '3(8)',
    };
    await vi.waitFor(() => {
      expect(changed).toHaveBeenCalledWith(saved.SAVED_KEY);
    });
    expect(call.mock.calls[0]?.slice(0, 2)).toEqual([
      'update_engagement_request',
      { request: REQUEST.id, draft },
    ]);
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
    const { call, changed } = stubWrites();
    show([REQUEST]);
    await userEvent.click(screen.getByRole('button', { name: 'ביטול הבקשה: ייעוץ ארגוני' }));
    const form = screen.getByRole('form', { name: 'ביטול הבקשה' });
    await userEvent.click(within(form).getByRole('button', { name: 'ביטול הבקשה' }));
    expect(call).not.toHaveBeenCalled();
    expect(await within(form).findByText(RULE_MESSAGES.required)).toBeDefined();
    await userEvent.type(within(form).getByLabelText(/^סיבת הביטול/u), ' הצורך בוטל ');
    await userEvent.click(within(form).getByRole('button', { name: 'ביטול הבקשה' }));
    await vi.waitFor(() => {
      expect(changed).toHaveBeenCalledWith(saved.SAVED_KEY);
    });
    expect(call.mock.calls[0]?.slice(0, 2)).toEqual([
      'cancel_engagement_request',
      { request: REQUEST.id, note: 'הצורך בוטל' },
    ]);
  });

  it('offers no edit for an approved request, only a check and a cancel', () => {
    show([{ ...REQUEST, status: 'approved' }]);
    expect(screen.queryByRole('button', { name: /^עריכת הבקשה/u })).toBeNull();
    expect(screen.getByRole('button', { name: 'ביטול הבקשה: ייעוץ ארגוני' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'בדיקה מחדש: ייעוץ ארגוני' })).toBeDefined();
  });
});
