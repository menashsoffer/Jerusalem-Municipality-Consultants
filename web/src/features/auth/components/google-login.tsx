import { useActionState } from 'react';
import { Button } from '../../../ui/button.tsx';
import { googleSignIn } from '../api/session.ts';
async function authorize(): Promise<string> {
  try {
    await googleSignIn({
      location: window.location,
      history: window.history,
      storage: window.sessionStorage,
    });
    return '';
  } catch {
    return 'לא ניתן להתחבר באמצעות Google כעת. יש לנסות שוב.';
  }
}
export function GoogleLogin() {
  const [error, action, pending] = useActionState(authorize, '');
  return (
    <form action={action} aria-label="כניסה עם Google">
      <Button type="submit" disabled={pending}>
        כניסה באמצעות Google
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
