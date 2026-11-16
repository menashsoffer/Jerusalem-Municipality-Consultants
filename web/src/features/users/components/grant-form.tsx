import { useActionState, useState } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { DataError } from '../../../data/client.ts';
import { addGrant, type Profile, type Unit } from '../api/users.ts';
import { parseGrant } from '../model/permissions.ts';
import { GrantFields } from './grant-fields.tsx';
interface Props {
  profiles: Profile[];
  scope: { admin: boolean; units: Unit[] };
}
export function GrantForm({ profiles, scope }: Props) {
  const [role, setRole] = useState('viewer');
  const refresh = useRevalidator();
  const [result, action, pending] = useActionState(
    async (_previous: { message: string; error: string }, form: FormData) => {
      const input = parseGrant(Object.fromEntries(form), scope);
      if (!input.data) return { message: '', error: input.error };
      try {
        await addGrant(input.data);
        await refresh.revalidate();
        return { message: 'התפקיד הוענק.', error: '' };
      } catch (error) {
        return {
          message: '',
          error:
            error instanceof DataError
              ? error.message
              : 'לא ניתן להשלים. יש לרענן ולבדוק לפני ניסיון נוסף.',
        };
      }
    },
    { message: '', error: '' },
  );
  return (
    <form action={action} aria-label="הענקת תפקיד">
      <GrantFields profiles={profiles} scope={scope} role={{ value: role, change: setRole }} />
      <Button type="submit" disabled={pending}>
        הענקת התפקיד
      </Button>
      <StatusMessage>{pending ? 'שומר…' : result.message}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}
