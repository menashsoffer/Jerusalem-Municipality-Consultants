import { useActionState, useRef } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { FormField } from '../../../ui/form-field.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { decideReview, INITIAL_REVIEW } from '../api/review.ts';
import styles from './users.module.css';
interface Props {
  id: string;
  name: string;
}
export function ProfileReviewForm({ id, name }: Props) {
  const refresh = useRevalidator(),
    note = useRef<HTMLInputElement>(null);
  const [result, action, pending] = useActionState(
    async (_previous: typeof INITIAL_REVIEW, form: FormData) => {
      const result = await decideReview(id, form, () => refresh.revalidate());
      if (result.fieldError) note.current?.focus();
      return result;
    },
    INITIAL_REVIEW,
  );
  return (
    <form action={action} aria-label={`החלטה על בקשת ${name}`}>
      <FormField
        field={{
          label: 'נימוק להחלטה',
          hint: 'בדחייה נדרש נימוק של שני תווים לפחות',
          error: result.fieldError,
        }}
        input={{ name: 'note', maxLength: 2000, ref: note }}
      />
      <div className={styles.actions}>
        <Button type="submit" name="decision" value="active" disabled={pending || result.committed}>
          אישור הבקשה
        </Button>
        <Button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending || result.committed}
        >
          דחיית הבקשה
        </Button>
      </div>
      <StatusMessage>{pending ? 'שומר החלטה…' : ''}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}
