import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthPage } from '../auth-page.tsx';
import type { Access, Role } from '../../../data/access.ts';
import { setAdminSession } from '../../../data/rpc.ts';
afterEach(() => {
  cleanup();
  setAdminSession(null);
});
function page(access: Access | null) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: AuthPage,
        loader: () => (access ? { userId: 'user', access } : null),
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}
describe('admin identity screen', () => {
  it('offers labelled native sign-in controls when signed out', async () => {
    page(null);
    expect(await screen.findByRole('heading', { name: 'כניסה והרשאות', level: 1 })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'דוא״ל (חובה)' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'שליחת קישור כניסה' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'כניסה באמצעות Google' })).toBeDefined();
  });
  for (const [state, message] of [
    ['pending', 'ממתינה'],
    ['blocked', 'חסומה'],
    ['rejected', 'נדחתה'],
    ['unregistered', 'נדרשת'],
  ] as const) {
    it(`explains ${state} without presenting a login form`, async () => {
      page({ state, member: false, admin: false, editor: false, manager: false, grants: [] });
      expect((await screen.findByRole('status')).textContent).toContain(message);
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  }
  for (const role of ['viewer', 'editor', 'unit_manager', 'admin', 'auditor'] satisfies Role[]) {
    it(`shows an active ${role} without trusting JWT claims`, async () => {
      page({
        state: 'active',
        member: true,
        admin: role === 'admin',
        editor: false,
        manager: false,
        grants: [{ role, unitId: null }],
      });
      expect(await screen.findByRole('button', { name: 'יציאה מהמערכת' })).toBeDefined();
      expect(screen.getByRole('status').textContent).toContain('פעילה');
    });
  }
  it('announces a callback error', async () => {
    setAdminSession(null, 'תוקף ניסיון ההתחברות פג.');
    page(null);
    expect((await screen.findByRole('alert')).textContent).toContain('פג');
  });
});
