import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { LoadControlPage } from '../load-control-page.tsx';
import type { LoadControl } from '../api/control.ts';

const value: LoadControl = {
  jobs: [
    { job: 'cbs-index', status: 'failed', started_at: '2026-11-16T05:00:00Z', finished_at: null },
  ],
  batches: [],
  registries: [
    { name: 'מאגר אולמות 2024', status: 'active', memberships: 52, needs_review: 52, verified: 0 },
  ],
  candidates: { companies_registrar: 3 },
  identifiers_pending: 7,
  same_names: 2,
  venues: 98,
};
afterEach(cleanup);

describe('load control page', () => {
  it('shows counts, registries and failed runs in words', () => {
    const router = createMemoryRouter(
      [{ id: 'control', path: '/', Component: LoadControlPage, loader: () => value }],
      { hydrationData: { loaderData: { control: value } } },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByText(/מועמדים ממתינים מרשם החברות/u)).toBeDefined();
    expect(screen.getByRole('rowheader', { name: 'מאגר אולמות 2024' })).toBeDefined();
    expect(screen.getByRole('cell', { name: 'נכשל' })).toBeDefined();
    expect(screen.getByText('אין טעינות קבצים רשומות')).toBeDefined();
  });
});
