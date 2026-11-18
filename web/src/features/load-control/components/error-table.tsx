// error-handling-spec-he.md section 8: errors people saw in the last 7 days, admins only.
import { DataTable } from '../../../ui/data-table.tsx';
import type { ErrorRow } from '../api/control.ts';
import { kindLabel, screenLabel, when } from '../model/labels.ts';
import styles from './control.module.css';

/** Faults in the system and an unreachable database need someone; they come first. */
const URGENT = new Set(['system', 'unavailable']);

export function ErrorTable({ errors }: { errors: ErrorRow[] | null }) {
  if (errors === null) return null;
  const urgent = errors.filter((row) => URGENT.has(row.kind)).length;
  return (
    <section className={styles.section} aria-labelledby="errors-title">
      <h2 id="errors-title">שגיאות שהוצגו ב-7 הימים האחרונים</h2>
      {errors.length === 0 ? (
        <p>לא הוצגו שגיאות בשבוע האחרון.</p>
      ) : (
        <DataTable
          caption={
            urgent
              ? `יש תקלות במערכת או במסד הנתונים שדורשות טיפול (${String(urgent)} שורות)`
              : 'לפי מספר הפעמים'
          }
          columns={[
            { id: 'kind', label: 'סוג' },
            { id: 'screen', label: 'מסך' },
            { id: 'failures', label: 'פעמים' },
            { id: 'last', label: 'אחרונה' },
          ]}
          rows={[...errors]
            .sort((a, b) => Number(URGENT.has(b.kind)) - Number(URGENT.has(a.kind)))
            .map((row) => ({
              id: `${row.kind}:${row.screen}`,
              cells: {
                kind: kindLabel(row.kind),
                screen: screenLabel(row.screen),
                failures: row.failures,
                last: when(row.last_at),
              },
            }))}
        />
      )}
    </section>
  );
}
