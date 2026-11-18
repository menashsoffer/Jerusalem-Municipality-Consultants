// The circle at the end of the top bar (screens-spec-he.md 11): a small menu with who is signed
// in, their main role, "החשבון שלי" and sign-out. Signed out, it is a link to sign in.
import { useId } from 'react';
import { Link } from 'react-router';
import { getAdminSession } from '../data/rpc.ts';
import { tokenEmail } from '../data/snapshot.ts';
import { useCatalogSnapshot } from '../data/react-catalog.ts';
import { signOut } from '../features/auth/api/session.ts';
import { Button } from '../ui/button.tsx';
import { Icon } from '../ui/icon.tsx';
import { mainRole } from './screens.ts';

function hide(id: string): void {
  document.getElementById(id)?.hidePopover();
}

export function AccountMenu() {
  const id = useId();
  const access = useCatalogSnapshot()?.access;
  const token = getAdminSession()?.token;
  if (!access || !token) {
    return (
      <Link to="/auth" className="shell-account" aria-label="כניסה למערכת" title="כניסה למערכת">
        <Icon name="person" />
      </Link>
    );
  }
  const email = tokenEmail(token);
  const role = mainRole(access);
  const initial = email?.[0]?.toUpperCase();
  return (
    <>
      <button
        type="button"
        className="shell-account"
        popoverTarget={id}
        aria-label="החשבון שלי"
        title="החשבון שלי"
      >
        {initial ?? <Icon name="person" />}
      </button>
      <div id={id} popover="auto" className="shell-menu">
        <p className="shell-menu-who">
          <strong dir="ltr">{email ?? 'משתמש מחובר'}</strong>
          {role && <span>{role}</span>}
        </p>
        <Link
          to="/auth"
          onClick={() => {
            hide(id);
          }}
        >
          החשבון שלי
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            יציאה מהמערכת
          </Button>
        </form>
      </div>
    </>
  );
}
