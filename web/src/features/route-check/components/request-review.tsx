import { useActionState } from 'react';
import { FormField } from '../../../ui/form-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { DataError } from '../../../data/client.ts';
import { checkRoute, type EngagementRequest } from '../api/check.ts';
import { money, type CheckResult } from '../model/result.ts';
interface Props {
  request: EngagementRequest;
  date: { value: string; change: (value: string) => void };
  navigation: { unit: string; back: () => void; complete: (result: CheckResult) => void };
}
export function RequestReview({ request, date, navigation }: Props) {
  const [error, action, pending] = useActionState(async () => {
    try {
      const result = await checkRoute({ request_id: request.id, on: date.value });
      navigation.complete(result);
      return '';
    } catch (error) {
      return error instanceof DataError
        ? error.message
        : 'לא ניתן לבצע את הבדיקה. יש לבדוק את הנתונים ולנסות שוב.';
    }
  }, '');
  return (
    <>
      <RequestSummary request={request} unit={navigation.unit} />
      <form action={action} aria-label="בדיקת המסלול">
        <FormField
          field={{ label: 'תאריך לבדיקה' }}
          input={{
            name: 'on',
            type: 'date',
            required: true,
            dir: 'ltr',
            value: date.value,
            disabled: pending,
            onChange: (e) => {
              date.change(e.currentTarget.value);
            },
          }}
        />
        <Button type="submit" disabled={pending}>
          בדיקת המסלול
        </Button>{' '}
        <Button onClick={navigation.back} disabled={pending}>
          חזרה לבחירת בקשה
        </Button>
        <StatusMessage>{pending ? 'בודק את נתוני הבקשה…' : ''}</StatusMessage>
        {error && <p role="alert">{error}</p>}
      </form>
    </>
  );
}

function RequestSummary({ request, unit }: { request: EngagementRequest; unit: string }) {
  return (
    <>
      <h3>{request.subject}</h3>
      <p>יחידה: {unit}</p>
      <p>
        שווי הבקשה: <bdi>{money(request.estimated_value)}</bdi> —{' '}
        {request.value_includes_vat ? 'כולל מע״מ' : 'ללא מע״מ'}
      </p>
      {request.requested_exemption && (
        <p>
          הפטור שהתבקש: <bdi>{request.requested_exemption}</bdi>
        </p>
      )}
    </>
  );
}
