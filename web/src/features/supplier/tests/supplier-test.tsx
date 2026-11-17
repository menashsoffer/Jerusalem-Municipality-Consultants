import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { compactCatalog } from '../../../data/compact-catalog.ts';
import { supplierDetail, type SupplierDetail } from '../../../data/supplier-detail.ts';
import { writableVersions, type WriteContext } from '../../../data/write-context.ts';
import * as rpc from '../../../data/rpc.ts';
import * as site from '../../../data/site.ts';
import {
  access,
  client,
  SUPPLIER,
  wireCatalog,
  wireDetail,
} from '../../../../tests/catalog-fixture.ts';
import { SupplierDetails } from '../components/supplier-details.tsx';
import { EditForms } from '../components/edit-forms.tsx';
import { AddForm } from '../components/add-form.tsx';
import { StatusForm } from '../components/status-form.tsx';

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

describe('supplier edits', () => {
  it('renames the supplier and refreshes the catalog', async () => {
    mockWrites();
    const rename = vi.spyOn(site, 'renameSupplier').mockResolvedValue('ok');
    show(<EditForms data={await detail()} />);
    const name = await screen.findByRole('textbox', { name: /שם הספק/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'שם חדש');
    await userEvent.click(screen.getByRole('button', { name: 'שמירת שם' }));
    expect(await screen.findByText('השם נשמר.')).toBeDefined();
    expect(rename).toHaveBeenCalledWith('token', { supplier_id: SUPPLIER, display_name: 'שם חדש' });
    expect(site.loadSnapshot).toHaveBeenCalledWith('token');
  });

  it('keeps the kind of an existing contact and reports a refused write', async () => {
    mockWrites();
    const data = await detail();
    data.contacts = data.contacts.map((c) => ({ ...c, status: 'current' }));
    const replace = vi.spyOn(site, 'replaceContact').mockRejectedValue(new Error('אין הרשאה.'));
    show(<EditForms data={data} />);
    const existing = await screen.findByRole('combobox', { name: 'פרט קשר קיים' });
    await userEvent.selectOptions(existing, 'contact1');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'סוג' }).disabled).toBe(true);
    const value = screen.getByRole('textbox', { name: /ערך/ });
    expect((value as HTMLInputElement).value).toBe('bad');
    await userEvent.clear(value);
    await userEvent.type(value, 'a@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'שמירת פרט קשר' }));
    expect((await screen.findByRole('alert')).textContent).toBe('אין הרשאה.');
    expect(replace).toHaveBeenCalledWith('token', {
      supplier_id: SUPPLIER,
      contact_id: 'contact1',
      kind: 'email',
      value: 'a@example.test',
    });
  });
});

describe('supplier status', () => {
  it('requires a reason before asking the database to deactivate', async () => {
    mockWrites();
    const call = vi.spyOn(rpc, 'rpc').mockResolvedValue(null);
    show(<StatusForm data={await detail()} today="2026-11-17" />);
    await userEvent.click(await screen.findByRole('button', { name: 'סימון כלא פעיל' }));
    expect((await screen.findByRole('alert')).textContent).toBe('יש למלא סיבה ותאריך.');
    expect(call).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole('textbox', { name: 'סיבה' }), 'מונתה לשופטת');
    await userEvent.click(screen.getByRole('button', { name: 'סימון כלא פעיל' }));
    expect(await screen.findByText('הספק סומן כלא פעיל.')).toBeDefined();
    expect(call.mock.calls[0]?.[1]).toEqual({
      target: SUPPLIER,
      change: { active: false, reason: 'מונתה לשופטת', source: '', changedOn: '2026-11-17' },
    });
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
