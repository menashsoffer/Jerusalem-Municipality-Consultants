import { useActionState } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { decide, INITIAL_DECISION } from '../api/decision.ts';
interface Props {
  id: string;
  supplier: string;
}
export function DecisionForm({ id, supplier }: Props) {
  const refresh = useRevalidator();
  const [result, action, pending] = useActionState(
    (_previous: typeof INITIAL_DECISION, form: FormData) =>
      decide(id, form, () => refresh.revalidate()),
    INITIAL_DECISION,
  );
  return (
    <form action={action} aria-label={`החלטה על מועמד עבור ${supplier}`}>
      <p>קבלת המועמד יוצרת מזהה שממתין לאימות של אדם נוסף.</p>
      <Button name="decision" value="accept" type="submit" disabled={pending || result.committed}>
        קבלת המועמד לבדיקה נוספת
      </Button>{' '}
      <Button name="decision" value="dismiss" type="submit" disabled={pending || result.committed}>
        דחיית המועמד
      </Button>
      <StatusMessage>{pending ? 'שומר החלטה…' : result.message}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}
