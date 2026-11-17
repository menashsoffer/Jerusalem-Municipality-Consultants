import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import * as rpc from '../../../data/rpc.ts';
import * as site from '../../../data/site.ts';
import { PKCE_KEY, SESSION_KEY } from '../../../data/session.ts';
import { googleSignIn, requestLink, signOut } from '../api/session.ts';
import { GoogleLogin } from '../components/google-login.tsx';

const IDLE = { message: '', error: '' };

function form(email: unknown): FormData {
  const data = new FormData();
  if (typeof email === 'string') data.set('email', email);
  return data;
}

function quietNavigation() {
  // jsdom does not implement navigation to another document and reports it on the console.
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('magic link', () => {
  it('rejects a missing or invalid address without a request', async () => {
    const send = vi.spyOn(site, 'sendLink');
    expect((await requestLink(IDLE, form(undefined))).error).toBe('יש להזין כתובת דוא״ל תקינה.');
    expect((await requestLink(IDLE, form('not-an-email'))).error).not.toBe('');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends a trimmed address and gives the same answer whether or not it exists', async () => {
    const send = vi.spyOn(site, 'sendLink').mockResolvedValue(new Response(null));
    const result = await requestLink(IDLE, form('  a@x.test '));
    expect(result).toEqual({ message: 'אם החשבון מורשה, קישור כניסה נשלח לדוא״ל.', error: '' });
    expect(send).toHaveBeenCalledWith('a@x.test', window.location.origin + '/');
  });

  it('asks to try again when the server or the network fails', async () => {
    const send = vi.spyOn(site, 'sendLink');
    send.mockResolvedValueOnce(new Response(null, { status: 500 }));
    send.mockRejectedValueOnce(new Error('offline'));
    for (let i = 0; i < 2; i += 1) {
      expect((await requestLink(IDLE, form('a@x.test'))).error).toBe(
        'לא ניתן לשלוח קישור כעת. יש לנסות שוב.',
      );
    }
  });
});

describe('Google and sign-out', () => {
  it('keeps a PKCE verifier and leaves for the authorize address', async () => {
    quietNavigation();
    await googleSignIn({
      location: window.location,
      history: window.history,
      storage: window.sessionStorage,
    });
    expect(window.sessionStorage.getItem(PKCE_KEY)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('shows an error when the Google sign-in cannot start', async () => {
    vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('no crypto'));
    render(<GoogleLogin />);
    await userEvent.click(screen.getByRole('button', { name: /כניסה באמצעות Google/u }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'לא ניתן להתחבר באמצעות Google כעת. יש לנסות שוב.',
    );
  });

  it('forgets the session and the cached catalog on sign-out', async () => {
    quietNavigation();
    window.sessionStorage.setItem(SESSION_KEY, 'x');
    const setSession = vi.spyOn(rpc, 'setAdminSession');
    const clear = vi.spyOn(site, 'clearCatalog').mockResolvedValue();
    await signOut();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(setSession).toHaveBeenCalledWith(null);
    expect(clear).toHaveBeenCalledOnce();
  });
});
