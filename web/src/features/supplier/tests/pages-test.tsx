// The supplier card and add-supplier screens, and the card's sparse and unknown values.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import * as reactCatalog from '../../../data/react-catalog.ts';
import * as rpc from '../../../data/rpc.ts';
import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import type { WriteContext } from '../../../data/write-context.ts';
import { access } from '../../../../tests/catalog-fixture.ts';
import * as write from '../api/write.ts';
import { AddSupplierPage, loader as addLoader } from '../add-page.tsx';
import { SupplierDetails } from '../components/supplier-details.tsx';
import { loader as supplierLoader, SupplierPage } from '../supplier-page.tsx';

const ID = '40000000-0000-0000-0000-000000000009';

function sparse(over: Partial<SupplierDetail['supplier']> = {}): SupplierDetail {
  return {
    supplier: {
      id: ID,
      display_name: 'ספק דליל',
      entity_kind: 'mystery',
      status: 'inactive',
      status_reason: null,
      status_source: null,
      status_changed_on: null,
      review_status: 'pending',
      website: null,
      note: null,
      ...over,
    },
    names: [],
    identifiers: [{ id: 'i1', scheme: 'odd', value: '1', review_status: 'odd', source: 'odd' }],
    contacts: [{ id: 'c1', kind: 'pager', value: '5', is_valid: null, status: 'current' }],
    memberships: [
      {
        registry_version_id: 'missing',
        registry_field_id: 'missing',
        review_status: 'odd',
        source_page: null,
        registered_from: null,
        registered_until: null,
        engagement_started_on: null,
        dates_source: 'odd',
      },
    ],
    versions: [],
    registries: [],
    fields: [],
    documents: [],
    audit: [],
  } as unknown as SupplierDetail;
}

function show(element: React.ReactNode) {
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element }])} />);
}

function page(Component: React.ComponentType, data: unknown) {
  const router = createMemoryRouter([{ id: 'p', path: '/', Component, loader: () => data }], {
    hydrationData: { loaderData: { p: data } },
  });
  render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('supplier card with sparse data', () => {
  it('says what is missing and falls back for unknown values', () => {
    show(<SupplierDetails data={sparse()} />);
    expect(screen.getByText('ספק לא מאומת')).toBeDefined();
    expect(screen.getByRole('note').textContent).toBe('הספק אינו פעיל');
    expect(screen.getByText('סוג ישות: לא ידוע')).toBeDefined();
    expect(screen.getByText('לא תועדו שמות נוספים.')).toBeDefined();
    expect(screen.getByText('מזהה: 1 · מצב לא ידוע')).toBeDefined();
    expect(screen.getAllByText('מקור: לא תועד').length).toBeGreaterThan(0);
    expect(screen.getByText('פרט קשר: 5')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'מאגר לא זמין' })).toBeDefined();
    expect(screen.getByText('מצב הרישום לא ידוע')).toBeDefined();
    expect(screen.getByText('תחום: לא צוין')).toBeDefined();
    expect(screen.getByText('לא נמצאו שינויים ביומן.')).toBeDefined();
  });

  it('lists the reason, source and date of an inactive status, and the site and note', () => {
    const data = sparse({
      status_reason: 'פירוק',
      status_source: 'רשם החברות',
      status_changed_on: '2026-01-01',
      website: 'https://x.test',
      note: 'הערה חשובה',
      review_status: 'verified',
    });
    show(<SupplierDetails data={data} />);
    expect(screen.getByRole('note').textContent).toBe(
      'הספק אינו פעיל · סיבה: פירוק · מקור: רשם החברות · מתאריך 2026-01-01',
    );
    expect(screen.getByText('ספק מאומת')).toBeDefined();
    expect(screen.getByText('אתר: https://x.test')).toBeDefined();
    expect(screen.getByText('הערה: הערה חשובה')).toBeDefined();
  });

  it('says so when there are no identifiers, contacts or memberships', () => {
    const data = { ...sparse(), identifiers: [], contacts: [], memberships: [] };
    show(<SupplierDetails data={data} />);
    expect(screen.getByText('לא תועדו מזהים שניתן להציג.')).toBeDefined();
    expect(screen.getByText('לא תועדו פרטי קשר.')).toBeDefined();
    expect(screen.getByText('אין רישומים שניתן להציג.')).toBeDefined();
  });
});

describe('supplier page', () => {
  it('confirms the session and starts loading the card in the loader', async () => {
    const resource = { supplierId: ID, userId: 'u', promise: Promise.resolve(sparse()) };
    vi.spyOn(rpc, 'identity').mockResolvedValue({ userId: 'u', access: access() });
    vi.spyOn(rpc, 'sessionToken').mockReturnValue('token');
    const create = vi.spyOn(reactCatalog, 'createSupplierDetailResource').mockReturnValue(resource);
    const args = { params: { id: ID }, request: new Request('https://x.test') } as never;
    expect(await supplierLoader(args)).toEqual({ resource });
    expect(create).toHaveBeenCalledWith('token', ID);
    await supplierLoader({ params: {}, request: new Request('https://x.test') } as never);
    expect(create).toHaveBeenLastCalledWith('token', '');
  });

  it.each([
    ['a viewer sees no forms', access(), 0],
    ['an editor sees the edit forms', access({ editor: true }), 1],
    ['an admin also sees the status form', access({ editor: true, admin: true }), 2],
  ])('%s', async (_name, who, forms) => {
    const resource = { supplierId: ID, userId: 'u', promise: Promise.resolve(sparse()) };
    vi.spyOn(reactCatalog, 'useSupplierDetail').mockReturnValue(sparse({ status: 'active' }));
    vi.spyOn(reactCatalog, 'useCatalogSnapshot').mockReturnValue({ access: who } as never);
    page(SupplierPage, { resource });
    expect(await screen.findByRole('heading', { level: 1, name: 'ספק דליל' })).toBeDefined();
    expect(screen.queryAllByRole('button', { name: 'שמירת שם' })).toHaveLength(forms > 0 ? 1 : 0);
    expect(screen.queryAllByRole('button', { name: 'סימון כלא פעיל' })).toHaveLength(
      forms > 1 ? 1 : 0,
    );
  });
});

describe('add supplier page', () => {
  const context = { catalog: {}, identifiers: [], versions: [] } as unknown as WriteContext;

  it('lets only active editors in', async () => {
    const who = vi.spyOn(rpc, 'identity');
    who.mockResolvedValueOnce({ userId: 'u', access: access() });
    await expect(addLoader()).rejects.toMatchObject({ status: 403 });
    who.mockResolvedValueOnce({ userId: 'u', access: access({ editor: true, state: 'blocked' }) });
    await expect(addLoader()).rejects.toMatchObject({ status: 403 });
    who.mockResolvedValueOnce({ userId: 'u', access: access({ editor: true }) });
    vi.spyOn(write, 'loadWriteContext').mockResolvedValue(context);
    expect(await addLoader()).toEqual({ context });
  });

  it('explains that there is no pool to add to', async () => {
    page(AddSupplierPage, { context });
    expect(await screen.findByText('אין מאגר זמין ביחידה שלך')).toBeDefined();
  });
});
