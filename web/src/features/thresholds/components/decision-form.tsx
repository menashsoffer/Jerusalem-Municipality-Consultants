import { useActionState } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { DataError } from '../../../data/client.ts';
import { decideProposal } from '../api/proposals.ts';
import styles from './proposal-card.module.css';
interface Result {
  message: string;
  error: string;
  decided: boolean;
}
interface Props {
  id: string;
  title: string;
}
export function DecisionForm({ id, title }: Props) {
  const revalidator = useRevalidator();
  const [result, action, pending] = useActionState(
    async (_previous: Result, form: FormData) => {
      const decision = form.get('decision');
      if (decision !== 'approve' && decision !== 'reject')
        return { message: '', error: 'יש לבחור החלטה.', decided: false };
      try {
        await decideProposal(id, decision === 'approve');
      } catch (error) {
        // P0002 (no pending proposal) arrives as 404: another admin decided it already.
        if (error instanceof DataError && error.status === 404) {
          await revalidator.revalidate().catch(() => undefined);
          return { message: 'ההצעה כבר טופלה. הרשימה רועננה.', error: '', decided: true };
        }
        return {
          message: '',
          error: error instanceof DataError ? error.message : 'לא ניתן לשמור את ההחלטה.',
          decided: false,
        };
      }
      try {
        await revalidator.revalidate();
      } catch {
        return {
          message: 'ההחלטה נשמרה, אך הרשימה לא התרעננה. יש לרענן לפני פעולה נוספת.',
          error: '',
          decided: true,
        };
      }
      return { message: 'ההחלטה נשמרה.', error: '', decided: true };
    },
    { message: '', error: '', decided: false },
  );
  return (
    <form action={action} aria-label={`החלטה על ספי ${title}`}>
      <div className={styles.actions}>
        <Button type="submit" name="decision" value="approve" disabled={pending || result.decided}>
          אישור הסף החודשי
        </Button>
        <Button type="submit" name="decision" value="reject" disabled={pending || result.decided}>
          דחיית ההצעה
        </Button>
      </div>
      <StatusMessage>{pending ? 'שומר החלטה…' : result.message}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}
