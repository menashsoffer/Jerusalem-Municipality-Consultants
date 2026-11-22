import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { compactCatalog } from '../../../data/compact-catalog.ts';
import { supplierDetail, type SupplierDetail } from '../../../data/supplier-detail.ts';
import * as rpc from '../../../data/rpc.ts';
import { refusal } from '../../../data/client.ts';
import { client, SUPPLIER, wireCatalog, wireDetail } from '../../../../tests/catalog-fixture.ts';
import { AreaInvite } from '../components/area-invite.tsx';
import { areaLink } from '../api/invite.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function detail(emails: string[]): Promise<SupplierDetail> {
  const api = client(() => Response.json(wireDetail({ audit: null })));
  const data = await supplierDetail(api, compactCatalog(wireCatalog()), SUPPLIER);
  const sample = data.contacts[0];
  if (!sample) throw new Error('fixture has no contact');
  data.contacts = emails.map((value) => ({ ...sample, kind: 'email', value, is_valid: true }));
  return data;
}

describe('the supplier area invite', () => {
  it('builds the area address from the site address', () => {
    expect(areaLink({ origin: 'https://x.test', pathname: '/admin.html' })).toBe(
      'https://x.test/admin.html#/supplier-area',
    );
  });

  it('is hidden when the supplier has no valid email', async () => {
    render(<AreaInvite data={await detail([])} />);
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('invites a chosen email and says that no email is sent', async () => {
    const call = vi.spyOn(rpc, 'rpc').mockResolvedValue('i1');
    render(<AreaInvite data={await detail(['office@example.co.il'])} />);
    await userEvent.click(screen.getByRole('button', { name: 'הזמנה לאזור האישי' }));
    expect(call).toHaveBeenCalledWith(
      'invite_supplier_account',
      { supplier_id: SUPPLIER, email: 'office@example.co.il' },
      expect.anything(),
    );
    expect(await screen.findByText(/המערכת לא שולחת דוא"ל/)).toBeDefined();
  });

  it('shows the refusal when the invite fails', async () => {
    vi.spyOn(rpc, 'rpc').mockRejectedValue(refusal(400, 'reason:invite_email_unknown', 'rule'));
    render(<AreaInvite data={await detail(['office@example.co.il'])} />);
    await userEvent.click(screen.getByRole('button', { name: 'הזמנה לאזור האישי' }));
    expect(await screen.findByRole('alert')).toBeDefined();
  });
});
