import { useActionState } from 'react';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { DataError } from '../../../data/client.ts';
import { checkRoute } from '../api/check.ts';
import { saveRequest } from '../api/engagement.ts';
import { readDraft, type DraftFields } from '../model/draft.ts';
import type { CheckResult } from '../model/result.ts';

interface Props {
  units: { id: string; name: string }[];
  today: string;
  complete: (result: CheckResult, requestId: string | null) => void;
}

/** With a unit the request is saved first and the check is stored; without one nothing is. */
async function run({ draft, unitId, subject }: DraftFields, on: string) {
  if (!unitId) return { result: await checkRoute({ draft, on }), requestId: null };
  const requestId = await saveRequest({ ...draft, unit_id: unitId, subject });
  return { result: await checkRoute({ request_id: requestId, on }), requestId };
}

function UnitField({ units }: Pick<Props, 'units'>) {
  return (
    <SelectField
      field={{ label: 'שמירה ביחידה', hint: 'בלי יחידה הבדיקה רק מחושבת ולא נשמרת' }}
      select={{
        name: 'unit_id',
        defaultValue: '',
        children: [
          <option key="" value="">
            בדיקה בלבד, בלי שמירה
          </option>,
          ...units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          )),
        ],
      }}
    />
  );
}

export function DraftForm({ units, today, complete }: Props) {
  const [error, action, pending] = useActionState(async (_: string, form: FormData) => {
    const fields = readDraft(form);
    if (typeof fields === 'string') return fields;
    try {
      const { result, requestId } = await run(fields, today);
      complete(result, requestId);
      return '';
    } catch (error) {
      return error instanceof DataError ? error.message : 'הבדיקה נכשלה. יש לנסות שוב.';
    }
  }, '');
  return (
    <form action={action} aria-label="פרטי בקשת ההתקשרות">
      <FormField field={{ label: 'נושא' }} input={{ name: 'subject', maxLength: 500 }} />
      <FormField
        field={{ label: 'אומדן בש״ח' }}
        input={{ name: 'estimated_value', inputMode: 'decimal', required: true, dir: 'ltr' }}
      />
      <label>
        <input type="checkbox" name="value_includes_vat" /> האומדן כולל מע״מ
      </label>
      <FormField
        field={{ label: 'פטור מבוקש', hint: 'אם יש, למשל 3(8)' }}
        input={{ name: 'requested_exemption', maxLength: 10, dir: 'ltr' }}
      />
      {units.length > 0 && <UnitField units={units} />}
      <Button type="submit" disabled={pending}>
        בדיקת מסלול
      </Button>
      <StatusMessage>{pending ? 'בודק…' : ''}</StatusMessage>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
