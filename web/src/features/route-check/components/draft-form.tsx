import { useActionState, useState } from 'react';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { FormActions } from '../../../ui/form-actions.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { errorText } from '../../../data/errors.ts';
import { checkRoute } from '../api/check.ts';
import { replaceShortlist } from '../../../lib/shortlist.ts';
import { saveRequest } from '../api/engagement.ts';
import { useReloadSaved } from './saved-list.tsx';
import { readDraft, type DraftFields } from '../model/draft.ts';
import type { CheckResult } from '../model/result.ts';
import styles from './route-check.module.css';

interface Props {
  units: { id: string; name: string }[];
  today: string;
  back: () => void;
  complete: (result: CheckResult, requestId: string | null) => void;
}

/** What the form says after a failed attempt (error-handling-spec-he.md sections 3 and 5). */
interface Outcome {
  tone: 'error' | 'warning';
  title: string;
  text: string;
}
const NONE: Outcome | null = null;

/** The request is saved, so the check runs on it again and never saves a second copy. */
function savedButUnchecked(error: unknown): Outcome {
  return {
    tone: 'warning',
    title: 'הבקשה נשמרה, אבל הבדיקה נכשלה.',
    text: `${errorText(error)} הבקשה מחכה גם ב"בקשות שמורות", ואפשר לבדוק אותה שוב בלי לשמור מחדש.`,
  };
}

function failed(error: unknown): Outcome {
  return { tone: 'error', title: 'לא ניתן לבדוק את הבקשה.', text: errorText(error) };
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

type Complete = Props['complete'];

async function checkSaved(id: string, run: { today: string; complete: Complete }, fresh = false) {
  try {
    run.complete(await checkRoute({ request_id: id, on: run.today }), id);
    return NONE;
  } catch (error) {
    return fresh ? savedButUnchecked(error) : failed(error);
  }
}

async function checkDraft({ draft }: DraftFields, run: { today: string; complete: Complete }) {
  try {
    run.complete(await checkRoute({ draft, on: run.today }), null);
    return NONE;
  } catch (error) {
    return failed(error);
  }
}

/**
 * With a unit the request is saved first and the check is stored; without one nothing is.
 * Once saved, `saved` holds its id and every later attempt only checks that request.
 */
function useCheck(today: string, complete: Complete) {
  const [saved, setSaved] = useState<string | null>(null);
  const reload = useReloadSaved();
  const run = { today, complete };
  const state = useActionState(async (_: Outcome | null, form: FormData) => {
    if (saved) return checkSaved(saved, run);
    const fields = readDraft(form);
    if (typeof fields === 'string') return { tone: 'error' as const, title: fields, text: '' };
    if (!fields.unitId) return checkDraft(fields, run);
    let id: string;
    try {
      id = await saveRequest({ ...fields.draft, unit_id: fields.unitId, subject: fields.subject });
    } catch (error) {
      return failed(error);
    }
    setSaved(id);
    // The picked suppliers now belong to the saved request, so the catalog tray closes.
    replaceShortlist([]);
    const outcome = await checkSaved(id, run, true);
    // After the check, so the new row shows its result too.
    await reload();
    return outcome;
  }, NONE);
  return { saved, state };
}

/** Step 2: the request details. The subject is needed only when the request is saved. */
export function DraftForm({ units, today, back, complete }: Props) {
  const [unit, setUnit] = useState('');
  const { saved, state } = useCheck(today, complete);
  const [outcome, action, pending] = state;
  return (
    <form action={action} aria-label="פרטי הבקשה" className={styles.form}>
      {outcome && (
        <Notice tone={outcome.tone} title={outcome.title}>
          {outcome.text}
        </Notice>
      )}
      <fieldset disabled={saved !== null} className={styles.fields}>
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
      </fieldset>
      <FormActions>
        <Button type="submit" pending={pending} pendingLabel="בודק…">
          {saved
            ? 'בדיקה חוזרת של הבקשה השמורה'
            : unit
              ? 'בדיקת מסלול ושמירה ביחידה'
              : 'בדיקת מסלול בלבד'}
        </Button>
        <Button variant="secondary" onClick={back} disabled={pending}>
          לשלב הקודם
        </Button>
      </FormActions>
      <StatusMessage>{pending ? 'בודק את המסלול…' : ''}</StatusMessage>
    </form>
  );
}
