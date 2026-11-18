import { useActionState } from 'react';
import { Button } from '../../../ui/button.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { decide, INITIAL_DECISION } from '../api/decision.ts';
import { SCHEMES, SOURCES, evidenceHint } from '../model/candidate.ts';
import { diffWords, MATCH_LABELS, type Listed } from '../model/match.ts';
import styles from './candidate.module.css';

function Name({ name, supplier }: { name: string; supplier: string }) {
  return (
    <>
      {diffWords(name, supplier).map((part, index) =>
        part.differs ? <mark key={index}>{part.text}</mark> : part.text,
      )}
    </>
  );
}

function Decision({ id, supplier }: { id: string; supplier: string }) {
  const [result, action, pending] = useActionState(
    (_: typeof INITIAL_DECISION, form: FormData) => decide(id, form),
    INITIAL_DECISION,
  );
  return (
    <form action={action} aria-label={`החלטה על מועמד עבור ${supplier}`} className={styles.actions}>
      <Button
        name="decision"
        value="accept"
        type="submit"
        pending={pending}
        disabled={result.committed}
      >
        קבלה לבדיקה נוספת
      </Button>
      <Button
        name="decision"
        value="dismiss"
        type="submit"
        variant="secondary"
        pending={pending}
        disabled={result.committed}
      >
        דחיית המועמד
      </Button>
      {result.message && <Notice tone="success" title={result.message} />}
      {result.error && <Notice tone="error" title={result.error} />}
    </form>
  );
}

/** One candidate: a compact line that opens to the three names and the decision. */
export function CandidateRow({ candidate, supplier, level }: Listed) {
  const registered = candidate.registrar_name;
  return (
    <details className={styles.row}>
      <summary>
        <strong>{supplier}</strong>
        <bdi dir="ltr">{candidate.value}</bdi>
        <span className={`${styles.tag ?? ''} ${styles[level] ?? ''}`}>{MATCH_LABELS[level]}</span>
        <span className={styles.source}>{SOURCES[candidate.source]}</span>
      </summary>
      <dl className={styles.names}>
        <dt>באתר</dt>
        <dd>{supplier}</dd>
        <dt>{candidate.source === 'pool_file' ? 'בקובץ' : 'בחיפוש'}</dt>
        <dd>
          <Name name={candidate.searched_name} supplier={supplier} />
        </dd>
        <dt>במרשם</dt>
        <dd>{registered ? <Name name={registered} supplier={supplier} /> : 'לא נמסר'}</dd>
        <dt>{SCHEMES[candidate.scheme]}</dt>
        <dd>
          <bdi dir="ltr">{candidate.value}</bdi>
        </dd>
        <dt>מצב במרשם</dt>
        <dd>{candidate.registrar_status ?? 'לא נמסר'}</dd>
      </dl>
      <p className={styles.hint}>{evidenceHint(candidate, supplier)}</p>
      <Decision id={candidate.id} supplier={supplier} />
    </details>
  );
}
