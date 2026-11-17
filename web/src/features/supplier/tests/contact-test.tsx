// The supplier page's contact card, copy button and back button.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { BackButton, cameFromCatalog } from '../components/back-button.tsx';
import { ContactCard } from '../components/contact-card.tsx';
import { CopyButton } from '../components/copy-button.tsx';

type Contact = SupplierDetail['contacts'][number];

function contact(id: string, kind: string, value: string): Contact {
  return { id, kind, value, is_valid: true, status: 'current' } as unknown as Contact;
}

function link(name: string): HTMLAnchorElement {
  return screen.getByRole<HTMLAnchorElement>('link', { name });
}

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('contact card', () => {
  it('links each kind, phone before email, and warns about an invalid value', () => {
    render(
      <ContactCard
        contacts={[
          contact('1', 'website', 'x.test'),
          { ...contact('2', 'email', 'a@b.test'), is_valid: false },
          contact('3', 'address', 'יפו 1'),
          contact('4', 'phone', '02-123-4567'),
          contact('5', 'contact_person', 'דנה'),
          contact('6', 'pager', 'זר'),
          contact('7', 'email', 'not an email'),
        ]}
      />,
    );
    expect(link('02-123-4567').href).toBe('tel:021234567');
    expect(link('a@b.test').href).toBe('mailto:a@b.test');
    expect(link('x.test').target).toBe('_blank');
    expect(link('פתיחה ב-Google Maps').href).toContain('maps/search');
    expect(screen.getByText('ייתכן שאינו תקין')).toBeDefined();
    expect(screen.getByText('not an email')).toBeDefined();
    expect(screen.getByRole('button', { name: 'העתקת פרט הקשר' })).toBeDefined();
    expect(screen.queryByText('אין טלפון במאגר')).toBeNull();
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    const at = (text: string) => items.findIndex((item) => item.includes(text));
    expect(at('02-123-4567')).toBeLessThan(at('a@b.test'));
  });
});

describe('copy button', () => {
  it('says it copied, then clears the bubble', async () => {
    vi.useFakeTimers();
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    render(<CopyButton value="02-1" label="טלפון" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'העתקת טלפון' }));
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(write).toHaveBeenCalledWith('02-1');
    expect(screen.getByRole('status').textContent).toBe('הועתק');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('says so when the browser refuses', async () => {
    vi.useFakeTimers();
    clipboard(() => Promise.reject(new Error('denied')));
    render(<CopyButton value="x" label="דוא״ל" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'העתקת דוא״ל' }));
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(screen.getByRole('status').textContent).toBe('ההעתקה נכשלה');
  });
});

describe('back button', () => {
  function open(state: unknown) {
    const router = createMemoryRouter(
      [
        { path: '/catalog', element: <p>הקטלוג</p> },
        { path: '/supplier', element: <BackButton /> },
      ],
      { initialEntries: ['/catalog', { pathname: '/supplier', state }], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
  }

  it('knows the catalog state only when it is set', () => {
    expect(cameFromCatalog({ fromCatalog: true })).toBe(true);
    expect(cameFromCatalog(null)).toBe(false);
    expect(cameFromCatalog('fromCatalog')).toBe(false);
  });

  it('goes back to the search results after a search', async () => {
    open({ fromCatalog: true });
    fireEvent.click(screen.getByRole('button', { name: 'חזרה לתוצאות החיפוש' }));
    expect(await screen.findByText('הקטלוג')).toBeDefined();
  });

  it('links to the catalog when opened directly', () => {
    open(null);
    expect(link('לאיתור ספקים').getAttribute('href')).toBe('/catalog');
  });
});
