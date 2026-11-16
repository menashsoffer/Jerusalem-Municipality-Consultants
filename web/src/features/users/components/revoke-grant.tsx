import { useActionState } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { DataError } from '../../../data/client.ts';
import { removeGrant } from '../api/users.ts';
interface Props {
  id: string;
  name: string;
}
export function RevokeGrant({ id, name }: Props) {
  const refresh = useRevalidator();
  const [error, action, pending] = useActionState(async () => {
    try {
      await removeGrant(id);
      await refresh.revalidate();
      return '';
    } catch (error) {
      return error instanceof DataError ? error.message : 'לא ניתן להסיר תפקיד. יש לרענן ולבדוק.';
    }
  }, '');
  return (
    <form action={action}>
      <Button type="submit" disabled={pending} aria-label={`הסרת תפקיד — ${name}`}>
        הסרת תפקיד
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
