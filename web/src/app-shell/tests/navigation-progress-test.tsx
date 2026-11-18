import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { Layout } from '../layout.tsx';

afterEach(cleanup);

describe('navigation progress', () => {
  it('shows a progress bar and fades the screen while the next screen loads', async () => {
    let finish = (): void => undefined;
    const slow = new Promise<null>((resolve) => {
      finish = () => {
        resolve(null);
      };
    });
    const router = createMemoryRouter([
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: <h1>ראשון</h1> },
          { path: 'next', loader: () => slow, element: <h1>שני</h1> },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    let moving: Promise<void> = Promise.resolve();
    act(() => {
      moving = router.navigate('/next');
    });
    expect(await screen.findByRole('progressbar', { name: 'טוען את המסך' })).toBeTruthy();
    expect(document.querySelector('main')?.hasAttribute('data-pending')).toBe(true);
    await act(async () => {
      finish();
      await moving;
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.querySelector('main')?.hasAttribute('data-pending')).toBe(false);
  });
});
