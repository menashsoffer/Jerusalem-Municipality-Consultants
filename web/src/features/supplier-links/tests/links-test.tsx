import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import * as rpc from '../../../data/rpc.ts';
import { DataError, refusal } from '../../../data/client.ts';
import { SupplierLinksPage } from '../links-page.tsx';
import { proofUrl, type SupplierLink } from '../api/links.ts';

const LINK: SupplierLink = {
  id: 'p',
  supplier_id: 's1',
  supplier_name: 'ספק',
  status: 'pending',
  method: 'document',
  proof_path: 'link-proofs/u/a.pdf',
  created_at: '2026-11-22T08:00:00Z',
  email: 'dana@example.co.il',
  first_name: 'דנה',
  last_name: 'כהן',
  job_title: 'מנכ"ל',
  phone: '0521234567',
};
const MATCHED: SupplierLink = {
  ...LINK,
  id: 'm',
  status: 'active',
  method: 'email_match',
  proof_path: null,
  first_name: null,
  last_name: null,
  job_title: null,
  phone: null,
};

function show(links: SupplierLink[]) {
  const router = createMemoryRouter(
    [{ id: 'links', path: '/', Component: SupplierLinksPage, loader: () => links }],
    { hydrationData: { loaderData: { links } } },
  );
  render(<RouterProvider router={router} />);
  for (const dialog of document.querySelectorAll('dialog')) dialog.setAttribute('open', '');
}
function answer(handler: (name: string, args: unknown) => unknown) {
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

describe('the supplier links queue', () => {
  it('says when nothing waits', () => {
    show([]);
    expect(screen.getByText('אין שיוכים לבדיקה')).toBeDefined();
  });

  it('groups waiting links and email matches, and approves a waiting one', async () => {
    vi.spyOn(rpc, 'requireRoles').mockResolvedValue({} as rpc.Identity);
    const call = answer((name) => (name === 'supplier_link_queue' ? [] : null));
    show([LINK, MATCHED]);
    const waiting = screen.getByRole('region', { name: 'ממתינים לאישור' });
    expect(within(waiting).getByText('דנה כהן')).toBeDefined();
    expect(within(waiting).getByText(/מסמך הוכחה/)).toBeDefined();
    const matched = screen.getByRole('region', { name: 'נכנסו בהתאמת דוא״ל השבוע' });
    expect(within(matched).getByText('בלי שם')).toBeDefined();
    expect(within(matched).queryByRole('button', { name: 'אישור' })).toBeNull();
    await userEvent.click(within(waiting).getByRole('button', { name: 'אישור' }));
    expect(call).toHaveBeenCalledWith(
      'decide_supplier_account',
      { account_id: 'p', approve: true, note: null },
      expect.anything(),
    );
  });

  it('asks for a reason before rejecting, and shows a refusal', async () => {
    const call = answer(() => {
      throw refusal(400, 'reason:already_decided', 'rule');
    });
    show([LINK]);
    const form = screen.getByRole('form', { name: 'דחיית השיוך לספק' });
    await userEvent.click(within(form).getByRole('button', { name: 'דחייה' }));
    expect(await within(form).findByText(/צריך לכתוב סיבה/)).toBeDefined();
    expect(call).not.toHaveBeenCalled();
    await userEvent.type(within(form).getByLabelText(/סיבה/), 'אין הוכחה');
    await userEvent.click(within(form).getByRole('button', { name: 'דחייה' }));
    expect(call).toHaveBeenCalledWith(
      'decide_supplier_account',
      { account_id: 'p', approve: false, note: 'אין הוכחה' },
      expect.anything(),
    );
    expect(await within(form).findByRole('alert')).toBeDefined();
  });

  it('revokes an active link with its reason', async () => {
    vi.spyOn(rpc, 'requireRoles').mockResolvedValue({} as rpc.Identity);
    const call = answer((name) => (name === 'supplier_link_queue' ? [] : null));
    show([MATCHED]);
    const form = screen.getByRole('form', { name: 'ביטול השיוך לספק' });
    await userEvent.type(within(form).getByLabelText(/סיבה/), 'לא עובד בספק');
    await userEvent.click(within(form).getByRole('button', { name: 'ביטול השיוך' }));
    expect(call).toHaveBeenCalledWith(
      'revoke_supplier_account',
      { account_id: 'm', note: 'לא עובד בספק' },
      expect.anything(),
    );
  });

  it('opens the proof through a short signed link', async () => {
    vi.spyOn(rpc, 'freshToken').mockResolvedValue('token');
    const send = vi.fn(() => Promise.resolve(Response.json({ signedURL: '/object/sign/x?t=1' })));
    const url = await proofUrl('link-proofs/u/a.pdf', send);
    expect(url).toMatch(/\/storage\/v1\/object\/sign\/x\?t=1$/);
    expect(String((send.mock.calls[0] as unknown[])[0])).toMatch(
      /\/object\/sign\/supplier-documents\/link-proofs\/u\/a\.pdf$/,
    );
    await expect(
      proofUrl('x', () => Promise.resolve(new Response('{}', { status: 400 }))),
    ).rejects.toThrow();
  });

  it('shows an error when the proof cannot open', async () => {
    vi.spyOn(rpc, 'freshToken').mockRejectedValue(new DataError(401));
    show([LINK]);
    await userEvent.click(screen.getByRole('button', { name: 'פתיחת ההוכחה' }));
    expect(await screen.findByRole('alert')).toBeDefined();
  });
});
