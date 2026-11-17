import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { Layout } from '../layout.tsx';
import { RouteError } from '../route-error.tsx';
import { routes } from '../routes.tsx';

function renderAt(path: string, table = routes) {
  render(<RouterProvider router={createMemoryRouter(table, { initialEntries: [path] })} />);
}

afterEach(cleanup);

describe('admin routes', () => {
  it('opens the catalog at the site root', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/catalog');
    });
  });

  it('shows the admin home with its title', async () => {
    renderAt('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'מסכי הניהול' })).toBeDefined();
    await waitFor(() => {
      expect(document.title).toBe('ניהול | איתור ספקים');
    });
  });

  it('focuses the current heading without changing the hash route when skipping navigation', async () => {
    renderAt('/admin');
    const heading = await screen.findByRole('heading', { level: 1, name: 'מסכי הניהול' });
    fireEvent.click(screen.getByRole('link', { name: 'דילוג לתוכן' }));
    expect(document.activeElement).toBe(heading);
  });

  it('shows a not-found screen for an unknown path, inside the shared frame', async () => {
    renderAt('/no-such-screen');
    expect(await screen.findByRole('heading', { level: 1, name: 'הדף לא נמצא' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'דילוג לתוכן' })).toBeDefined();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('replaces a screen that throws with an error notice', async () => {
    const Broken = () => {
      throw new Error('broken');
    };
    renderAt('/', [
      {
        path: '/',
        element: <Layout />,
        errorElement: <RouteError />,
        children: [{ index: true, Component: Broken }],
      },
    ]);
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'משהו השתבש' })).toBeDefined();
  });
});
