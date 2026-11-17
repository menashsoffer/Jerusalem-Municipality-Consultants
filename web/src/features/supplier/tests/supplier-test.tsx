import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { compactCatalog } from '../../../data/compact-catalog.ts';
import { supplierDetail, type SupplierDetail } from '../../../data/supplier-detail.ts';
import { writableVersions, type WriteContext } from '../../../data/write-context.ts';
import * as rpc from '../../../data/rpc.ts';
import * as site from '../../../data/site.ts';
import { DataError } from '../../../data/client.ts';
import { RULE_MESSAGES } from '../../../lib/rules/messages.ts';
import {
  access,
  client,
  SUPPLIER,
  wireCatalog,
  wireDetail,
} from '../../../../tests/catalog-fixture.ts';
import { SupplierDetails } from '../components/supplier-details.tsx';
import { EditDialog } from '../components/edit-dialog.tsx';
import { AddForm } from '../components/add-form.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function detail(audit: unknown = null): Promise<SupplierDetail> {
  const api = client(() => Response.json(wireDetail({ audit })));
  return supplierDetail(api, compactCatalog(wireCatalog()), SUPPLIER);
}

function show(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '/', element, loader: () => null }]);
  render(<RouterProvider router={router} />);
}

function mockWrites() {
  vi.spyOn(rpc, 'sessionToken').mockReturnValue('token');
  vi.spyOn(site, 'loadSnapshot').mockResolvedValue(
    {} as Awaited<ReturnType<typeof site.loadSnapshot>>,
  );
}

describe('supplier details', () => {
  it('shows invalid contacts, listing dates and source links, without history for a viewer', async () => {
    const data = await detail();
    data.memberships = data.memberships.map((m) => ({
      ...m,
      engagement_started_on: '2024-02-01',
      dates_source: 'municipal_registry',
    }));
    show(<SupplierDetails data={data} today="2026-11-17" />);
    expect(await screen.findByText('ייתכן שאינו תקין')).toBeDefined();
    expect(screen.getByText('תחילת התקשרות: 01.02.2024')).toBeDefined();
    expect(screen.queryByText(/לא תועד/)).toBeNull();
    expect(screen.getByText('bad').closest('a')).toBeNull();
    const links = screen.getAllByRole('link', { name: /מסמך המאגר|מסמך מקור/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.getAttribute('href') === 'https://example.test/source')).toBe(
      true,
    );
    expect(links.every((link) => link.getAttribute('rel') === 'noopener noreferrer')).toBe(true);
    expect(screen.queryByRole('heading', { name: 'היסטוריית שינויים' })).toBeNull();
    expect(screen.getByRole('button', { name: 'ספק מאומת' })).toBeDefined();
  });

  it('marks a waiting supplier with a labelled clock that shows its label on focus', async () => {
    const data = await detail();
    data.supplier = { ...data.supplier, review_status: 'needs_review' };
    show(<SupplierDetails data={data} today="2026-11-17" />);
    const mark = await screen.findByRole('button', { name: 'ממתין לאימות' });
    const tip = screen.getByText('ממתין לאימות');
    expect(tip.hidden).toBe(true);
    await userEvent.tab();
    while (document.activeElement !== mark) await userEvent.tab();
    expect(tip.hidden).toBe(false);
    await userEvent.keyboard('{Escape}');
    expect(tip.hidden).toBe(true);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('ממתין לאימות');
  });

  it('shows the history as sentences with field names only, when the server sends it', async () => {
    const entry = {
      id: 1,
      row_id: 'x',
      table_name: 'suppliers',
      operation: 'UPDATE',
      changes: { display_name: { old: 'ישן', new: 'חדש' } },
      created_at: '2026-11-12T12:00:00Z',
    };
    show(<SupplierDetails data={await detail([entry])} today="2026-11-17" />);
    expect(await screen.findByRole('heading', { name: 'היסטוריית שינויים' })).toBeDefined();
    expect(screen.getByText('עודכנו פרטי הספק: שם')).toBeDefined();
    expect(screen.getByText('גלוי למנהלי מערכת בלבד')).toBeDefined();
    expect(screen.queryByText(/ישן/)).toBeNull();
  });
});

async function openDialog(data: SupplierDetail, admin = false) {
  show(<EditDialog data={data} editor admin={admin} today="2026-11-17" />);
  const dialog = await waitFor(() => {
    const found = document.querySelector('dialog');
    if (!found) throw new Error('no dialog yet');
    return found;
  });
  dialog.setAttribute('open', '');
}

describe('supplier edit dialog', () => {
  it('saves the name and a changed contact together with one button', async () => {
    mockWrites();
    const save = vi.spyOn(site, 'updateSupplier').mockResolvedValue('ok');
    const data = await detail();
    data.contacts = data.contacts.map((c) => ({ ...c, status: 'current', value: 'a@b.co.il' }));
    await openDialog(data);
    const name = await screen.findByRole('textbox', { name: /שם הספק/ });
    await userEvent.clear(name);
    await userEvent.type(name, '  שם   חדש ');
    const email = screen.getByRole('textbox', { name: 'דוא״ל' });
    await userEvent.clear(email);
    await userEvent.type(email, 'office@example.co.il');
    await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('השינויים נשמרו.')).toBeDefined();
    expect(save).toHaveBeenCalledWith('token', {
      supplier_id: SUPPLIER,
      display_name: 'שם חדש',
      contacts: [{ contact_id: 'contact1', kind: 'email', value: 'office@example.co.il' }],
    });
    expect(site.loadSnapshot).toHaveBeenCalledWith('token');
  });

  it('marks each broken rule beside its field and sends nothing', async () => {
    mockWrites();
    const save = vi.spyOn(site, 'updateSupplier').mockResolvedValue('ok');
    await openDialog(await detail());
    const name = await screen.findByRole('textbox', { name: /שם הספק/ });
    await userEvent.clear(name);
    await userEvent.type(name, '12345');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'פרט קשר חדש' }), 'phone');
    await userEvent.type(screen.getByRole('textbox', { name: 'ערך' }), 'שטויות');
    await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect((await screen.findByRole('alert')).textContent).toBe('יש לתקן את השדות המסומנים.');
    expect(screen.getByText(/יש לכתוב מילים/)).toBeDefined();
    expect(screen.getByText(/מספר טלפון לא תקין/)).toBeDefined();
    expect(save).not.toHaveBeenCalled();
  });

  it('shows a rule the database refused in plain Hebrew', async () => {
    mockWrites();
    vi.spyOn(site, 'updateSupplier').mockRejectedValue(
      new DataError(400, RULE_MESSAGES.bad_check_digit),
    );
    const data = await detail();
    data.contacts = [];
    await openDialog(data);
    const name = await screen.findByRole('textbox', { name: /שם הספק/ });
    await userEvent.type(name, ' נוסף');
    await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect((await screen.findByRole('alert')).textContent).toBe(RULE_MESSAGES.bad_check_digit);
  });
});

describe('supplier status', () => {
  it('asks an admin for a reason and a past date before deactivating', async () => {
    mockWrites();
    const call = vi.spyOn(rpc, 'rpc').mockResolvedValue(null);
    await openDialog(await detail(), true);
    const mark = await screen.findByRole('button', { name: 'סימון כלא פעיל' });
    expect(mark.className).toMatch(/danger/);
    await userEvent.click(mark);
    await userEvent.click(screen.getByRole('button', { name: 'אישור סימון כלא פעיל' }));
    expect(await screen.findByText(RULE_MESSAGES.required)).toBeDefined();
    expect(call).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole('textbox', { name: /סיבה/ }), 'מונתה לשופטת');
    await userEvent.click(screen.getByRole('button', { name: 'אישור סימון כלא פעיל' }));
    expect(await screen.findByText('הספק סומן כלא פעיל.')).toBeDefined();
    expect(call.mock.calls[0]?.[1]).toEqual({
      target: SUPPLIER,
      change: { active: false, reason: 'מונתה לשופטת', changedOn: '2026-11-17' },
    });
    expect(screen.getByRole('button', { name: 'סגירה' })).toBeDefined();
  });
});

describe('status panel and verification mark', () => {
  it('reactivates an inactive supplier after confirming, or cancels', async () => {
    mockWrites();
    const call = vi.spyOn(rpc, 'rpc').mockResolvedValue(null);
    const data = await detail();
    data.supplier = { ...data.supplier, status: 'inactive' };
    await openDialog(data, true);
    await userEvent.click(await screen.findByRole('button', { name: 'סימון כפעיל' }));
    await userEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(screen.queryByRole('button', { name: 'אישור סימון כפעיל' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'סימון כפעיל' }));
    await userEvent.click(screen.getByRole('button', { name: 'אישור סימון כפעיל' }));
    expect(await screen.findByText('הספק סומן כפעיל.')).toBeDefined();
    expect(call.mock.calls[0]?.[1]).toEqual({ target: SUPPLIER, change: { active: true } });
  });

  it('keeps what was typed when the database refuses a status change', async () => {
    mockWrites();
    vi.spyOn(rpc, 'rpc').mockRejectedValue(new Error('נדחה.'));
    show(<EditDialog data={await detail()} editor={false} admin today="2026-11-17" />);
    const dialog = await waitFor(() => {
      const found = document.querySelector('dialog');
      if (!found) throw new Error('no dialog yet');
      return found;
    });
    dialog.setAttribute('open', '');
    await userEvent.click(await screen.findByRole('button', { name: 'סימון כלא פעיל' }));
    await userEvent.type(screen.getByRole('textbox', { name: /סיבה/ }), 'החברה פורקה');
    await userEvent.type(screen.getByRole('textbox', { name: /מקור/ }), 'רשם החברות');
    await userEvent.click(screen.getByRole('button', { name: 'אישור סימון כלא פעיל' }));
    expect((await screen.findByRole('alert')).textContent).toBe('נדחה.');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /סיבה/ }).value).toBe(
      'החברה פורקה',
    );
    expect(screen.queryByRole('textbox', { name: /שם הספק/ })).toBeNull();
  });

  it('says when nothing changed and keeps the typed values after a refused save', async () => {
    mockWrites();
    vi.spyOn(site, 'updateSupplier').mockRejectedValue(new Error('נדחה.'));
    const data = await detail();
    data.contacts = [];
    await openDialog(data);
    await userEvent.click(await screen.findByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('אין שינויים לשמירה.')).toBeDefined();
    const name = screen.getByRole<HTMLInputElement>('textbox', { name: /שם הספק/ });
    await userEvent.type(name, ' נוסף');
    await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect((await screen.findByRole('alert')).textContent).toBe('נדחה.');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /שם הספק/ }).value).toMatch(
      /נוסף$/,
    );
  });

  it('shows the mark label on hover and on tap', async () => {
    show(<SupplierDetails data={await detail()} today="2026-11-17" />);
    const mark = await screen.findByRole('button', { name: 'ספק מאומת' });
    const tip = screen.getByText('ספק מאומת');
    await userEvent.hover(mark);
    expect(tip.hidden).toBe(false);
    await userEvent.unhover(mark);
    expect(tip.hidden).toBe(true);
    await userEvent.click(mark);
    expect(tip.hidden).toBe(false);
  });
});

describe('adding a supplier', () => {
  function context(): WriteContext {
    const catalog = compactCatalog(wireCatalog());
    const editor = access({ editor: true, grants: [{ role: 'editor', unitId: 'u1' }] });
    return { catalog, identifiers: [], versions: writableVersions(catalog, editor) };
  }

  it('offers a similar supplier and saves the membership on the one chosen', async () => {
    mockWrites();
    const save = vi.spyOn(site, 'saveMembership').mockResolvedValue('ok');
    show(<AddForm context={context()} />);
    await userEvent.type(await screen.findByRole('textbox', { name: /שם ספק/ }), 'שם נוכחי');
    await userEvent.click(screen.getByRole('radio', { name: 'שם נוכחי' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /מאגר וגרסה/ }), 'v1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /תחום/ }), 'f1');
    await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('הרישום נשמר וממתין לאימות.')).toBeDefined();
    const payload = save.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      display_name: 'שם נוכחי',
      supplier_id: SUPPLIER,
      registry_version_id: 'v1',
      registry_field_id: 'f1',
    });
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>('textbox', { name: /שם ספק/ }).value).toBe('');
    });
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('offers only the pools the editor may write to', async () => {
    show(<AddForm context={context()} />);
    const pool = await screen.findByRole('combobox', { name: /מאגר וגרסה/ });
    expect([...(pool as HTMLSelectElement).options].map((o) => o.value)).toEqual(['', 'v1']);
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: /תחום/ }).disabled).toBe(true);
  });
});
