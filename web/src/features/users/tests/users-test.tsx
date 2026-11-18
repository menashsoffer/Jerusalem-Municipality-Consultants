import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { UsersPage } from '../users-page.tsx';
import * as api from '../api/users.ts';
import * as changes from '../api/changes.ts';
import { DataError } from '../../../data/client.ts';
const target: api.Profile = {
  user_id: 'target',
  first_name: 'משתמש',
  last_name: 'לדוגמה',
  email: 'user@example.test',
  job_title: 'יועץ',
  unit_id: 'own',
  purpose: 'עבודה מול מאגרי הספקים',
  status: 'pending',
};
function data(): Awaited<ReturnType<typeof api.loadUsers>> {
  return {
    who: {
      userId: 'admin',
      access: {
        state: 'active' as const,
        member: true,
        admin: true,
        editor: true,
        manager: false,
        grants: [{ role: 'admin' as const, unitId: null }],
      },
    },
    profiles: [
      target,
      { ...target, user_id: 'admin', first_name: 'מנהל', status: 'active' as const },
    ],
    grants: [] as api.GrantRow[],
    units: [
      { id: 'own', name: 'יחידה א' },
      { id: 'other', name: 'יחידה ב' },
    ],
    changes: null,
    now: 0,
  };
}
function page(value: ReturnType<typeof data>) {
  const router = createMemoryRouter(
    [{ id: 'users', path: '/', Component: UsersPage, loader: () => value }],
    {
      initialEntries: ['/'],
      hydrationData: { loaderData: { users: value } },
    },
  );
  render(<RouterProvider router={router} />);
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const CHANGE: changes.PendingChange = {
  id: 'c1',
  user_id: 'target',
  kind: 'details',
  role: null,
  unit_id: null,
  grant_id: null,
  details: { job_title: 'יועצת בכירה' },
  reason: 'קיבלתי קידום',
  status: 'pending',
  created_at: '2026-11-18T08:00:00Z',
  decided_at: null,
  decision_note: null,
};
describe('pending change requests', () => {
  it('shows what changes and why, and approves it', async () => {
    const value = { ...data(), changes: [CHANGE] };
    page(value);
    const decide = vi.spyOn(changes, 'decideChange').mockImplementation(() => {
      value.changes = [];
      return Promise.resolve();
    });
    const card = await screen.findByRole('article', { name: /עדכון פרטים: תפקיד בעירייה/ });
    expect(within(card).getByText('תפקיד בעירייה: יועצת בכירה')).toBeDefined();
    expect(within(card).getByText(/הסיבה: קיבלתי קידום/)).toBeDefined();
    await userEvent.click(within(card).getByRole('button', { name: 'אישור' }));
    expect(decide).toHaveBeenCalledWith('c1', true, '');
    expect(await screen.findByRole('heading', { name: 'אין בקשות שינוי ממתינות' })).toBeDefined();
  });
  it('needs a reason to reject and reports a refusal', async () => {
    page({ ...data(), changes: [CHANGE] });
    const decide = vi
      .spyOn(changes, 'decideChange')
      .mockRejectedValue(new DataError(403, 'אין הרשאה.'));
    const card = await screen.findByRole('article', { name: /עדכון פרטים/ });
    await userEvent.click(within(card).getByRole('button', { name: 'דחייה' }));
    const note = within(card).getByRole('textbox', { name: /נימוק/ });
    await waitFor(() => {
      expect(note.getAttribute('aria-invalid')).toBe('true');
    });
    expect(decide).not.toHaveBeenCalled();
    await userEvent.type(note, 'אין תקן פנוי');
    await userEvent.click(within(card).getByRole('button', { name: 'דחייה' }));
    expect(decide).toHaveBeenCalledWith('c1', false, 'אין תקן פנוי');
    expect(await within(card).findByRole('alert')).toBeDefined();
  });
  it('leaves the section out where change requests are not available', async () => {
    page(data());
    expect(await screen.findByRole('heading', { name: 'בקשות גישה ממתינות' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'בקשות שינוי ממתינות' })).toBeNull();
  });
});
describe('users and roles', () => {
  it('shows pending context and requires a reason before rejection', async () => {
    const value = data();
    page(value);
    const review = vi.spyOn(api, 'reviewProfile').mockResolvedValue();
    await userEvent.click(await screen.findByRole('button', { name: 'דחיית הבקשה' }));
    const note = screen.getByRole('textbox', { name: 'נימוק להחלטה' });
    await waitFor(() => {
      expect(note.getAttribute('aria-invalid')).toBe('true');
    });
    expect(document.activeElement).toBe(note);
    expect(review).not.toHaveBeenCalled();
  });
  it('does not present self-approval controls', async () => {
    const value = data();
    value.who.userId = 'target';
    page(value);
    expect(await screen.findByText('אין לאשר את הבקשה של עצמך.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'אישור הבקשה' })).toBeNull();
  });
  it('approves through the RPC and refreshes the pending list', async () => {
    const value = data();
    page(value);
    const review = vi.spyOn(api, 'reviewProfile').mockImplementation(() => {
      value.profiles = value.profiles.map((p) => ({ ...p, status: 'active' }));
      return Promise.resolve();
    });
    await userEvent.click(await screen.findByRole('button', { name: 'אישור הבקשה' }));
    expect(await screen.findByRole('heading', { name: 'אין בקשות ממתינות' })).toBeDefined();
    expect(review).toHaveBeenCalledWith('target', 'active', '');
  });
  it('offers a manager only viewer/editor and managed units', async () => {
    const value = data();
    value.who.access = {
      ...value.who.access,
      admin: false,
      manager: true,
      grants: [{ role: 'unit_manager', unitId: 'own' }],
    };
    page(value);
    await screen.findByRole('heading', { name: 'משתמשים ותפקידים' });
    const role = screen.getByRole('combobox', { name: 'תפקיד' });
    expect(within(role).queryByRole('option', { name: 'מנהל מערכת' })).toBeNull();
    expect(
      within(screen.getByRole('combobox', { name: 'יחידה' })).queryByRole('option', {
        name: 'יחידה ב',
      }),
    ).toBeNull();
  });
  it('announces permission errors when a grant is rejected by the server', async () => {
    const value = data();
    page(value);
    vi.spyOn(api, 'addGrant').mockRejectedValue(new DataError(403));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'משתמש' }), 'admin');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'יחידה' }), 'own');
    await userEvent.click(screen.getByRole('button', { name: 'הענקת התפקיד' }));
    expect((await screen.findByRole('alert')).textContent).toContain('אין לך הרשאה');
  });
  it('removes a role only after server confirmation', async () => {
    const value = data();
    value.grants = [
      {
        id: 'grant',
        user_id: 'admin',
        role: 'viewer',
        unit_id: 'own',
        expires_at: null,
        revoked_at: null,
      },
    ];
    page(value);
    const remove = vi.spyOn(api, 'removeGrant').mockImplementation(() => {
      value.grants = [];
      return Promise.resolve();
    });
    await userEvent.click(await screen.findByRole('button', { name: /הסרת תפקיד/ }));
    expect(await screen.findByRole('heading', { name: 'אין תפקידים פעילים להצגה' })).toBeDefined();
    expect(remove).toHaveBeenCalledWith('grant');
  });
});
