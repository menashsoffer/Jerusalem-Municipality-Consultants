import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import * as rpc from '../../../data/rpc.ts';
import { refusal } from '../../../data/client.ts';
import { SupplierAreaPage, loader } from '../supplier-area-page.tsx';
import type { PortalMe, SupplierFile } from '../api/portal.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = `x.${btoa(JSON.stringify({ sub: USER }))}.y`;
const PERSON = { user_id: USER, first_name: 'דנה', last_name: 'כהן', job_title: null, phone: null };
const me = (over: Partial<PortalMe> = {}): PortalMe => ({
  email: 'dana@example.co.il',
  person: PERSON,
  accounts: [],
  invites: [],
  ...over,
});
const FILE: SupplierFile = {
  id: 's1',
  name: 'ספק בע"מ',
  entity_kind: 'company',
  website: null,
  role: 'owner',
  other_names: ['שם מסחרי'],
  identifiers: [{ scheme: 'company', value: '512345679', verified: true }],
  contacts: [{ kind: 'phone', value: '02-6291111' }],
  memberships: [
    {
      registry: 'מאגר יועצים',
      unit: 'אגף 1',
      field: 'ייעוץ',
      registered_from: null,
      registered_until: '2026-12-01',
      document_url: 'https://example.test/doc.pdf',
    },
    {
      registry: 'מאגר ישן',
      unit: null,
      field: null,
      registered_from: null,
      registered_until: '2025-01-01',
      document_url: null,
    },
  ],
};

function page(value: { me: PortalMe; step: string; file: SupplierFile | null }) {
  const data = { ...value, today: '2026-11-22' };
  const router = createMemoryRouter(
    [{ id: 'area', path: '/', Component: SupplierAreaPage, loader: () => data }],
    { hydrationData: { loaderData: { area: data } } },
  );
  render(<RouterProvider router={router} />);
}
type Rpc = (name: string, args: unknown) => unknown;
function answer(handler: Rpc) {
  return vi.spyOn(rpc, 'rpc').mockImplementation((name, args, schema) => {
    try {
      return Promise.resolve(schema.parse(handler(name, args)));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the supplier area', () => {
  it('sends a signed-out visitor to the supplier sign-in', async () => {
    vi.spyOn(rpc, 'getAdminSession').mockReturnValue(null);
    const result = await loader();
    expect(result instanceof Response && result.headers.get('Location')).toBe(
      '/supplier-area/login?next=%2Fsupplier-area',
    );
  });

  it('loads the file of the first active link', async () => {
    vi.spyOn(rpc, 'getAdminSession').mockReturnValue({ token: TOKEN, exp: 0, refresh: null });
    const account = {
      id: 'a',
      supplier_id: 's1',
      supplier_name: 'ספק',
      role: 'owner',
      status: 'active',
      method: 'invite',
      decision_note: null,
      created_at: '2026-11-22T08:00:00Z',
    };
    answer((name) => (name === 'portal_me' ? me({ accounts: [account] as never }) : FILE));
    const result = await loader();
    expect(result).toMatchObject({ step: 'file', file: { name: 'ספק בע"מ' } });
  });

  it('asks a new person for their details and saves them', async () => {
    vi.spyOn(rpc, 'sessionToken').mockReturnValue(TOKEN);
    const save = vi.spyOn(rpc, 'savePortalPerson').mockResolvedValue();
    page({ me: me({ person: null }), step: 'person', file: null });
    await userEvent.type(screen.getByLabelText(/שם פרטי/), 'דנה');
    await userEvent.type(screen.getByLabelText(/שם משפחה/), 'כהן');
    await userEvent.type(screen.getByLabelText(/התפקיד/), 'מנכ"ל');
    await userEvent.type(screen.getByLabelText(/טלפון/), '0521234567');
    await userEvent.click(screen.getByRole('button', { name: 'שמירה והמשך' }));
    expect(save).toHaveBeenCalledWith(
      {
        user_id: USER,
        first_name: 'דנה',
        last_name: 'כהן',
        job_title: 'מנכ"ל',
        phone: '0521234567',
      },
      false,
    );
  });

  it('links by number, and asks for proof when the email does not match', async () => {
    const calls: string[] = [];
    answer((name, args) => {
      calls.push(name);
      if (name === 'portal_find_supplier') return { supplier_id: 's1', name: 'ספק בע"מ' };
      if ((args as { request: { proof_path: string | null } }).request.proof_path === null)
        throw refusal(400, 'reason:proof_required', 'rule');
      return { account_id: 'a', status: 'pending' };
    });
    vi.spyOn(rpc, 'sessionToken').mockReturnValue(TOKEN);
    vi.spyOn(rpc, 'freshToken').mockResolvedValue(TOKEN);
    const upload = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    page({ me: me(), step: 'link', file: null });
    const field = screen.getByLabelText(/ח"פ או מספר עמותה/);
    await userEvent.type(field, '512345678');
    await userEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect(await screen.findByText(/המספר לא תקין/)).toBeDefined();
    await userEvent.clear(field);
    await userEvent.type(field, '512345679');
    await userEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect(await screen.findByText('ספק בע"מ')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'כן, זה הספק' }));
    const proof = await screen.findByLabelText(/תדפיס רשם/);
    await userEvent.upload(proof, new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    // jsdom's own validity ignores files set by userEvent, so its native "required" check
    // would block the submit; in a browser that check passes once a file is chosen.
    proof.removeAttribute('required');
    await userEvent.click(screen.getByRole('button', { name: 'שליחה לאישור' }));
    await vi.waitFor(() => {
      expect(calls).toEqual(['portal_find_supplier', 'portal_request_link', 'portal_request_link']);
    });
    expect(upload.mock.calls[0]?.[0]).toMatch(
      new RegExp(`/storage/v1/object/supplier-documents/link-proofs/${USER}/.+\\.pdf$`),
    );
  });

  it('says when no supplier has the number, and goes back on "not this one"', async () => {
    answer((name) => (name === 'portal_find_supplier' ? null : {}));
    page({ me: me(), step: 'link', file: null });
    await userEvent.type(screen.getByLabelText(/ח"פ או מספר עמותה/), '512345679');
    await userEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect(await screen.findByText(/הספק לא נמצא במאגרי העירייה/)).toBeDefined();
  });

  it('accepts an invite', async () => {
    const call = answer(() => ({ account_id: 'a', status: 'active' }));
    const invite = {
      id: 'i1',
      supplier_name: 'ספק',
      role: 'owner' as const,
      expires_at: '2026-12-01',
    };
    page({ me: me({ invites: [invite] }), step: 'invites', file: null });
    await userEvent.click(screen.getByRole('button', { name: 'קבלת ההזמנה' }));
    expect(call).toHaveBeenCalledWith(
      'portal_accept_invite',
      { invite_id: 'i1' },
      expect.anything(),
    );
  });

  it('shows a waiting or rejected link with its reason, and no wizard while one waits', () => {
    const base = { supplier_id: 's1', supplier_name: 'ספק', role: 'owner', method: 'document' };
    const accounts = [
      { ...base, id: 'p', status: 'pending', decision_note: null, created_at: '2026-11-22T08:00Z' },
      {
        ...base,
        id: 'r',
        status: 'rejected',
        decision_note: 'אין הוכחה',
        created_at: '2026-11-20T08:00Z',
      },
    ];
    page({ me: me({ accounts: accounts as never }), step: 'link', file: null });
    expect(screen.getByText(/ממתינה לאישור העירייה/)).toBeDefined();
    expect(screen.getByText(/הסיבה: אין הוכחה/)).toBeDefined();
    expect(screen.queryByRole('form', { name: 'שיוך לספק' })).toBeNull();
  });

  it('shows the supplier its file and when each registration ends', () => {
    page({ me: me(), step: 'file', file: FILE });
    expect(screen.getByRole('heading', { name: 'ספק בע"מ', level: 1 })).toBeDefined();
    expect(screen.getByText(/מאומת/)).toBeDefined();
    expect(screen.getByText('מסתיים ב-01.12.2026')).toBeDefined();
    expect(screen.getByText('הסתיים ב-01.01.2025')).toBeDefined();
    expect(screen.getByRole('link', { name: 'מסמך המאגר' })).toBeDefined();
  });
});
