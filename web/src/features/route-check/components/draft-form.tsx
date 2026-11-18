import { useActionState, useState } from 'react';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { FormActions } from '../../../ui/form-actions.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { DataError } from '../../../data/client.ts';
import { checkRoute } from '../api/check.ts';
import { saveRequest } from '../api/engagement.ts';
import { readDraft, type DraftFields } from '../model/draft.ts';
import type { CheckResult } from '../model/result.ts';
import styles from './route-check.module.css';

interface Props {
  units: { id: string; name: string }[];
  today: string;
  back: () => void;
  complete: (result: CheckResult, requestId: string | null) => void;
}

/** With a unit the request is saved first and the check is stored; without one nothing is. */
async function run({ draft, unitId, subject }: DraftFields, on: string) {
  if (!unitId) return { result: await checkRoute({ draft, on }), requestId: null };
  const requestId = await saveRequest({ ...draft, unit_id: unitId, subject });
  return { result: await checkRoute({ request_id: requestId, on }), requestId };
}

function UnitField({
  units,
  unit,
  change,
}: Pick<Props, 'units'> & { unit: string; change: (id: string) => void }) {
  return (
    <SelectField
      field={{ label: 'יחידה', hint: 'בלי יחידה הבדיקה רק מחושבת ולא נשמרת.' }}
      select={{
        name: 'unit_id',
        value: unit,
        onChange: (e) => {
          change(e.currentTarget.value);
        },
        children: [
          <option key="" value="">
            בדיקה בלבד, בלי שמירה
          </option>,
          ...units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          )),
        ],
      }}
    />
  );
}

function useCheck(today: string, complete: Props['complete']) {
  return useActionState(async (_: string, form: FormData) => {
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
}

/** Step 2: the request details. The subject is needed only when the request is saved. */
export function DraftForm({ units, today, back, complete }: Props) {
  const [unit, setUnit] = useState('');
  const [error, action, pending] = useCheck(today, complete);
  return (
    <form action={action} aria-label="פרטי הבקשה" className={styles.form}>
      {error && (
        <Notice tone="error" title="לא ניתן לבדוק את הבקשה.">
          {error}
        </Notice>
      )}
      <FormField
        field={{ label: 'נושא' }}
        input={{ name: 'subject', maxLength: 500, required: !!unit }}
      />
      <FormField
        field={{ label: 'אומדן בש״ח' }}
        input={{ name: 'estimated_value', inputMode: 'decimal', required: true, dir: 'ltr' }}
      />
      <label className={styles.check}>
        <input type="checkbox" name="value_includes_vat" /> האומדן כולל מע״מ
      </label>
      <FormField
        field={{ label: 'פטור מבוקש', hint: 'אם יש, למשל 3(8).' }}
        input={{ name: 'requested_exemption', maxLength: 10, dir: 'ltr' }}
      />
      {units.length > 0 && <UnitField units={units} unit={unit} change={setUnit} />}
      <FormActions>
        <Button type="submit" pending={pending} pendingLabel="בודק…">
          {unit ? 'בדיקת מסלול ושמירה ביחידה' : 'בדיקת מסלול בלבד'}
        </Button>
        <Button variant="secondary" onClick={back} disabled={pending}>
          לשלב הקודם
        </Button>
      </FormActions>
      <StatusMessage>{pending ? 'בודק את המסלול…' : ''}</StatusMessage>
    </form>
  );
}
