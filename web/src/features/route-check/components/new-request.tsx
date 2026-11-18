// A new request in three steps (screens-spec-he.md 2.א): suppliers, details, result.
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { FormActions } from '../../../ui/form-actions.tsx';
import { toggleShortlist } from '../../../lib/shortlist.ts';
import controls from '../../../ui/control.module.css';
import type { EngagementData } from '../api/engagement.ts';
import type { CheckResult } from '../model/result.ts';
import { DraftForm } from './draft-form.tsx';
import { EMPTY_ENTRY, type Entry } from '../model/entry.ts';
import { PickedList } from './picked-list.tsx';
import { ResultPanel } from './result-panel.tsx';
import { ShortlistTools } from './shortlist-tools.tsx';
import { STEPS, Steps, type Step } from './steps.tsx';
import styles from './route-check.module.css';

interface Checked {
  result: CheckResult;
  requestId: string | null;
  /** Kept from the moment of the check: saving empties the tab's list, and a reload reads it. */
  suppliers: EngagementData['suppliers'];
}

function useWizard() {
  const [step, setStep] = useState<Step>('suppliers');
  const heading = useRef<HTMLHeadingElement>(null);
  function move(next: Step): void {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return { step, move, heading };
}

function SupplierStep({ data, next }: { data: EngagementData; next: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <PickedList
        suppliers={data.suppliers}
        remove={(id) => {
          toggleShortlist(id);
          // Drop a shared list from the address so the loader reads the updated one.
          void navigate('/engagement', { replace: true });
        }}
      />
      <FormActions>
        <Button onClick={next}>המשך</Button>
        <Link to="/catalog" className={controls.quiet}>
          להמשך איתור ספקים
        </Link>
      </FormActions>
    </>
  );
}

function ResultStep({
  data,
  checked,
  back,
}: {
  data: EngagementData;
  checked: Checked;
  back: () => void;
}) {
  return (
    <>
      <ResultPanel result={checked.result} />
      <ShortlistTools
        suppliers={checked.suppliers}
        today={data.today}
        requestId={checked.requestId}
      />
      <Button variant="quiet" onClick={back} className={styles.back}>
        חזרה לפרטי הבקשה
      </Button>
    </>
  );
}

export function NewRequest({ data }: { data: EngagementData }) {
  const { step, move, heading } = useWizard();
  const [checked, setChecked] = useState<Checked>();
  const [entry, setEntry] = useState<Entry>(EMPTY_ENTRY);
  return (
    <section aria-labelledby="new-request" className={styles.panel}>
      <h2 id="new-request">בקשה חדשה</h2>
      <Steps current={step} reachable={(key) => key !== 'result' || !!checked} go={move} />
      <h3 tabIndex={-1} ref={heading} className={styles.stepTitle}>
        {STEPS[step]}
      </h3>
      {step === 'suppliers' && (
        <SupplierStep
          data={data}
          next={() => {
            move('details');
          }}
        />
      )}
      {step === 'details' && (
        <DraftForm
          units={data.units}
          today={data.today}
          entry={entry}
          keep={setEntry}
          back={() => {
            move('suppliers');
          }}
          complete={(result, requestId) => {
            setChecked({ result, requestId, suppliers: data.suppliers });
            move('result');
          }}
        />
      )}
      {step === 'result' && checked && (
        <ResultStep
          data={data}
          checked={checked}
          back={() => {
            move('details');
          }}
        />
      )}
    </section>
  );
}
