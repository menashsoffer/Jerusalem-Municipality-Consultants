import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { CategoriesPage } from '../categories-page.tsx';
import * as rpc from '../../../data/rpc.ts';
import type { loadRequests } from '../api/requests.ts';
import { DataError } from '../../../data/client.ts';
function data(): Awaited<ReturnType<typeof loadRequests>> {
  return {
    userId: 'admin',
    requests: [
      {
        id: 'request',
        proposed_name: 'ייעוץ אקוסטי',
        description: 'נדרש תחום חסר',
        parent_id: null,
        source_reference: 'מסמך העירייה',
        created_by: 'viewer',
      },
    ],
    categories: [{ id: 'existing', name: 'ייעוץ סביבתי' }],
  };
}
function page(value = data()) {
  const router = createMemoryRouter(
    [{ id: 'categories', path: '/', Component: CategoriesPage, loader: () => value }],
    { hydrationData: { loaderData: { categories: value } } },
  );
  render(<RouterProvider router={router} />);
  return value;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('category review', () => {
  it('offers approval and linking on an own request, since one administrator decides', () => {
    const value = data();
    value.requests = value.requests.map((request) => ({ ...request, created_by: 'admin' }));
    page(value);
    expect(screen.getByRole('button', { name: 'אישור ויצירת קטגוריה' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'קישור לקטגוריה קיימת' })).toBeDefined();
  });
  it('requires a reason before rejection', async () => {
    page();
    const call = vi.spyOn(rpc, 'rpc');
    await userEvent.click(screen.getByRole('button', { name: 'דחיית הבקשה' }));
    expect((await screen.findByRole('alert')).textContent).toContain('נימוק');
    expect(call).not.toHaveBeenCalled();
  });
  it('approves only after the RPC succeeds and then refreshes the list', async () => {
    const value = page();
    const call = vi.spyOn(rpc, 'rpc').mockImplementation((_name, _args, schema) => {
      value.requests = [];
      return Promise.resolve(schema.parse('new-category'));
    });
    await userEvent.click(screen.getByRole('button', { name: 'אישור ויצירת קטגוריה' }));
    expect(await screen.findByRole('heading', { name: 'אין בקשות קטגוריה ממתינות' })).toBeDefined();
    expect(call.mock.calls[0]?.slice(0, 2)).toEqual([
      'decide_category_request',
      { request_id: 'request', decision: 'approved', note: '', category_id: null },
    ]);
  });
  it('links to the selected category and sends the reason', async () => {
    const value = page();
    const call = vi.spyOn(rpc, 'rpc').mockImplementation((_name, _args, schema) => {
      value.requests = [];
      return Promise.resolve(schema.parse('existing'));
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'קטגוריה קיימת לקישור' }),
      'existing',
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'נימוק להחלטה' }), 'כפילות');
    await userEvent.click(screen.getByRole('button', { name: 'קישור לקטגוריה קיימת' }));
    expect(await screen.findByRole('heading', { name: 'אין בקשות קטגוריה ממתינות' })).toBeDefined();
    expect(call.mock.calls[0]?.[1]).toMatchObject({
      decision: 'linked',
      note: 'כפילות',
      category_id: 'existing',
    });
  });
  it('keeps the request visible when the database denies approval', async () => {
    page();
    vi.spyOn(rpc, 'rpc').mockRejectedValue(new DataError(403));
    await userEvent.click(screen.getByRole('button', { name: 'אישור ויצירת קטגוריה' }));
    expect((await screen.findByRole('alert')).textContent).toContain('אין לך הרשאה');
    expect(screen.getByRole('heading', { name: 'ייעוץ אקוסטי' })).toBeDefined();
  });

  it('refreshes the list when another administrator already decided the request', async () => {
    const value = page();
    vi.spyOn(rpc, 'rpc').mockImplementation(() => {
      value.requests = [];
      return Promise.reject(new DataError(404));
    });
    await userEvent.click(screen.getByRole('button', { name: 'אישור ויצירת קטגוריה' }));
    expect(await screen.findByRole('heading', { name: 'אין בקשות קטגוריה ממתינות' })).toBeDefined();
  });
});
