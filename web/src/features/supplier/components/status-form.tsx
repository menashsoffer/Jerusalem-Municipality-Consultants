import { useActionState } from 'react';
import { useRevalidator } from 'react-router';
import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { Button } from '../../../ui/button.tsx';
import { FormField } from '../../../ui/form-field.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { IDLE, saveAndRefresh, status, type SaveResult } from '../api/write.ts';
import { formText } from '../model/add-form.ts';

interface Props {
  data: SupplierDetail;
  today: string;
}

/** Admin only. Marking a supplier inactive blocks new engagements with it in the database. */
export function StatusForm({ data, today }: Props) {
  const revalidator = useRevalidator();
  const { supplier } = data;
  const inactive = supplier.status === 'inactive';
  const [result, action, pending] = useActionState(async (_: SaveResult, form: FormData) => {
    if (inactive) {
      return saveAndRefresh(
        status(supplier.id, { active: true }),
        () => revalidator.revalidate(),
        'הספק סומן כפעיל.',
      );
    }
    const reason = formText(form, 'reason');
    const changedOn = formText(form, 'changed_on');
    if (!reason || !changedOn) return { message: '', error: 'יש למלא סיבה ותאריך.' };
    const change = { active: false, reason, source: formText(form, 'source'), changedOn };
    return saveAndRefresh(
      status(supplier.id, change),
      () => revalidator.revalidate(),
      'הספק סומן כלא פעיל.',
    );
  }, IDLE);
  return (
    <form action={action} aria-label="מצב פעילות הספק">
      <h3>מצב פעילות</h3>
      {!inactive && (
        <>
          <FormField field={{ label: 'סיבה' }} input={{ name: 'reason', maxLength: 500 }} />
          <FormField
            field={{ label: 'מקור', hint: 'למשל פרסום, החלטה או מסמך' }}
            input={{ name: 'source', maxLength: 500 }}
          />
          <FormField
            field={{ label: 'מתאריך' }}
            input={{ name: 'changed_on', type: 'date', defaultValue: today }}
          />
        </>
      )}
      <Button type="submit" disabled={pending}>
        {inactive ? 'סימון כפעיל' : 'סימון כלא פעיל'}
      </Button>
      <StatusMessage>{pending ? 'שומר…' : result.message}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}
