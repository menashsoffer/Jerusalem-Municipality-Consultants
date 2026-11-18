// Saved requests and checking one again on another date (screens-spec-he.md 2.ב).
import { useActionState, useState } from 'react';
import { Button } from '../../../ui/button.tsx';
import { DataTable } from '../../../ui/data-table.tsx';
import { Dialog } from '../../../ui/dialog.tsx';
import { EmptyState } from '../../../ui/empty-state.tsx';
import { FormActions } from '../../../ui/form-actions.tsx';
import { FormField } from '../../../ui/form-field.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { errorText } from '../../../data/errors.ts';
import { dayOf } from '../../../lib/dates.ts';
import { checkRoute } from '../api/check.ts';
import type { SavedRequest } from '../api/saved.ts';
import { money, STATUS_LABELS, type CheckResult } from '../model/result.ts';
import { ResultPanel } from './result-panel.tsx';
import styles from './route-check.module.css';

interface Props {
  requests: SavedRequest[];
  units: Map<string, string>;
  today: string;
}
const RECHECK = 'recheck-request';
const COLUMNS = [
  { id: 'subject', label: 'נושא' },
  { id: 'unit', label: 'יחידה' },
  { id: 'value', label: 'אומדן' },
  { id: 'date', label: 'תאריך' },
  { id: 'status', label: 'הבדיקה האחרונה' },
  { id: 'action', label: 'פעולה' },
];

function Recheck({ request, unit, today }: { request: SavedRequest; unit: string; today: string }) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, action, pending] = useActionState(async (_: string, form: FormData) => {
    try {
      const on = form.get('on');
      setResult(await checkRoute({ request_id: request.id, on: typeof on === 'string' ? on : '' }));
      return '';
    } catch (cause) {
      return errorText(cause);
    }
  }, '');
  return (
    <form action={action} aria-label="בדיקה מחדש" className={styles.form}>
      <p className={styles.summary}>
        {unit} · <bdi>{money(request.estimated_value)}</bdi>{' '}
        {request.value_includes_vat ? 'כולל מע״מ' : 'ללא מע״מ'}
        {request.requested_exemption && (
          <>
            {' '}
            · פטור מבוקש <bdi>{request.requested_exemption}</bdi>
          </>
        )}
      </p>
      {error && <Notice tone="error" title={error} />}
      <FormField
        field={{ label: 'תאריך לבדיקה' }}
        input={{ name: 'on', type: 'date', required: true, dir: 'ltr', defaultValue: today }}
      />
      <FormActions>
        <Button type="submit" pending={pending} pendingLabel="בודק…">
          בדיקת המסלול
        </Button>
      </FormActions>
      {result && <ResultPanel result={result} />}
    </form>
  );
}

function statusText(status: SavedRequest['lastStatus']): string {
  return status ? STATUS_LABELS[status] : 'טרם נבדקה';
}

export function SavedRequests({ requests, units, today }: Props) {
  const [chosen, setChosen] = useState<SavedRequest | null>(null);
  const rows = requests.map((r) => ({
    id: r.id,
    cells: {
      subject: r.subject,
      unit: units.get(r.unit_id) ?? 'יחידה לא זמינה',
      value: <bdi>{money(r.estimated_value)}</bdi>,
      date: dayOf(r.created_at),
      status: statusText(r.lastStatus),
      action: (
        <Button
          variant="quiet"
          aria-label={`בדיקה מחדש: ${r.subject}`}
          command={{ target: RECHECK, action: 'show-modal' }}
          onClick={() => {
            setChosen(r);
          }}
        >
          בדיקה מחדש
        </Button>
      ),
    },
  }));
  return (
    <section aria-labelledby="saved-requests" className={styles.panel}>
      <h2 id="saved-requests">בקשות שמורות</h2>
      {requests.length ? (
        <DataTable caption="בקשות שמורות ביחידות שלך" columns={COLUMNS} rows={rows} />
      ) : (
        <EmptyState title="אין בקשות שמורות">
          <p>בקשה נשמרת כשבוחרים לה יחידה בשלב פרטי הבקשה.</p>
        </EmptyState>
      )}
      <Dialog id={RECHECK} title={chosen ? `בדיקה מחדש: ${chosen.subject}` : 'בדיקה מחדש'}>
        {chosen && (
          <Recheck
            key={chosen.id}
            request={chosen}
            unit={units.get(chosen.unit_id) ?? 'יחידה לא זמינה'}
            today={today}
          />
        )}
      </Dialog>
    </section>
  );
}
