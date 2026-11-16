import { useRef, useState } from 'react';
import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { Button } from '../../ui/button.tsx';
import { loadRequests } from './api/check.ts';
import type { CheckResult } from './model/result.ts';
import { RequestChoice } from './components/request-choice.tsx';
import { RequestReview } from './components/request-review.tsx';
import { ResultPanel } from './components/result-panel.tsx';
export const loader = loadRequests;
const STEPS = { choose: 'בחירת בקשה', review: 'בדיקת הנתונים', result: 'תוצאת הבדיקה' };
export function RouteCheckPage() {
  const data = useLoaderData<typeof loader>(),
    navigation = useNavigation();
  return (
    <>
      <h1 tabIndex={-1}>בדיקת מסלול ההתקשרות</h1>
      {navigation.state === 'loading' ? (
        <Skeleton />
      ) : data.requests.length === 0 ? (
        <EmptyState title="אין בקשות זמינות לבדיקה">
          <p>לא נמצאו בקשות התקשרות ביחידות המורשות שלך.</p>
        </EmptyState>
      ) : (
        <Wizard data={data} />
      )}
    </>
  );
}
function Wizard({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  const [selected, setSelected] = useState(''),
    [date, setDate] = useState(data.today);
  const [step, setStep] = useState<keyof typeof STEPS>('choose'),
    [result, setResult] = useState<CheckResult | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = data.requests.find((r) => r.id === selected);
  function move(next: keyof typeof STEPS): void {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  const visible = request ? step : 'choose';
  const state = { visible, request, selected, setSelected, date, setDate, result, setResult, move };
  return (
    <>
      <ol aria-label="שלבי בדיקת המסלול">
        {Object.entries(STEPS).map(([key, label]) => (
          <li key={key} aria-current={visible === key ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>
      <h2 tabIndex={-1} ref={heading}>
        {STEPS[visible]}
      </h2>
      <WizardStage state={state} data={data} />
    </>
  );
}

interface WizardState {
  visible: keyof typeof STEPS;
  request: Awaited<ReturnType<typeof loader>>['requests'][number] | undefined;
  selected: string;
  setSelected: (id: string) => void;
  date: string;
  setDate: (date: string) => void;
  result: CheckResult | null;
  setResult: (value: CheckResult) => void;
  move: (next: keyof typeof STEPS) => void;
}
function WizardStage({
  state,
  data,
}: {
  state: WizardState;
  data: Awaited<ReturnType<typeof loader>>;
}) {
  const { visible, request, selected, setSelected, date, setDate, result, setResult, move } = state;
  return (
    <>
      {visible === 'choose' ? (
        <RequestChoice
          requests={data.requests}
          selection={{ value: selected, change: setSelected }}
          next={() => {
            move('review');
          }}
        />
      ) : visible === 'review' && request ? (
        <RequestReview
          request={request}
          date={{ value: date, change: setDate }}
          navigation={{
            unit: data.units.find((u) => u.id === request.unit_id)?.name ?? 'יחידה לא זמינה',
            back: () => {
              move('choose');
            },
            complete: (value) => {
              setResult(value);
              move('result');
            },
          }}
        />
      ) : result ? (
        <>
          <ResultPanel result={result} />
          <Button
            onClick={() => {
              move('choose');
            }}
          >
            בדיקה נוספת
          </Button>
        </>
      ) : null}
    </>
  );
}
