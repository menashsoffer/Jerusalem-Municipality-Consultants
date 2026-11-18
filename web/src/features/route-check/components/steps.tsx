import styles from './route-check.module.css';

export const STEPS = { suppliers: 'הספקים', details: 'פרטי הבקשה', result: 'תוצאה' } as const;
export type Step = keyof typeof STEPS;

/** The step indicator at the top of a new request (screens-spec 2.א). */
export function Steps({ current }: { current: Step }) {
  return (
    <ol aria-label="שלבי הבקשה" className={styles.steps}>
      {Object.entries(STEPS).map(([key, label]) => (
        <li key={key} aria-current={current === key ? 'step' : undefined}>
          {label}
        </li>
      ))}
    </ol>
  );
}
