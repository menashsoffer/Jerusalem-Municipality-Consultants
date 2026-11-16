import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ScreenError } from '../screen-error.tsx';
import { DataError } from '../../data/client.ts';
afterEach(cleanup);
for (const [status, title] of [
  [401, 'פג תוקף ההתחברות'],
  [403, 'אין הרשאה למסך'],
] as const) {
  it(`gives HTTP ${String(status)} a distinct explanation inside the existing main`, async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <main>
              <ScreenError />
            </main>
          ),
          loader: () => {
            throw new DataError(status);
          },
          errorElement: (
            <main>
              <ScreenError />
            </main>
          ),
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: title })).toBeDefined();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
}
