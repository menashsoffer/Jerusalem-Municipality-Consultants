import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Button } from '../button.tsx';
import { PageLoader } from '../logo-dots.tsx';
import { Skeleton } from '../skeleton.tsx';

afterEach(cleanup);

describe('loading indicators (DESIGN.md 6.8)', () => {
  it('announces a skeleton once and hides its shapes from screen readers', () => {
    const { container } = render(<Skeleton shape="cards" label="טוען את רשימת הספקים…" />);
    expect(screen.getByRole('status').textContent).toBe('טוען את רשימת הספקים…');
    const shapes = container.querySelector('[aria-hidden="true"]');
    expect(shapes?.children).toHaveLength(6);
  });

  it('draws as many placeholders as the shape of the screen', () => {
    const { container } = render(<Skeleton shape="detail" />);
    expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(2);
  });

  it('shows the logo dots with a spoken label for a screen with no shape yet', () => {
    const { container } = render(<PageLoader label="טוען את האתר…" />);
    expect(screen.getByRole('status').textContent).toBe('טוען את האתר…');
    expect(container.querySelectorAll('[aria-hidden="true"] i')).toHaveLength(5);
  });

  it('adds dots to a saving button without changing its name', () => {
    const { container } = render(<Button pending>שמירה</Button>);
    expect(screen.getByRole('button', { name: 'שומר…' })).toBeTruthy();
    expect(container.querySelectorAll('button [aria-hidden="true"] i')).toHaveLength(5);
  });
});
