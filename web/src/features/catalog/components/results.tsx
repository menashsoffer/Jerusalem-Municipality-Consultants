import { useState, useSyncExternalStore } from 'react';
import type { Supplier } from '../../../catalog-model.ts';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { EmptyState } from '../../../ui/empty-state.tsx';
import { SHORTLIST_MAX, useShortlist } from '../../../lib/shortlist.ts';
import { createBatches, BATCH_SIZE } from '../model/batches.ts';
import { SupplierCard } from './supplier-card.tsx';
import styles from './catalog.module.css';
interface Props {
  suppliers: Supplier[];
  today: string;
}
export function Results({ suppliers, today }: Props) {
  const [batches] = useState(() => createBatches(suppliers.length));
  const count = useSyncExternalStore(batches.subscribe, batches.getSnapshot, batches.getSnapshot);
  const picked = useShortlist();
  const full = picked.length >= SHORTLIST_MAX;
  if (!suppliers.length)
    return (
      <EmptyState title="לא נמצאו ספקים">
        <p>אפשר לשנות את החיפוש או את המסננים.</p>
      </EmptyState>
    );
  return (
    <section aria-label="תוצאות החיפוש">
      <h2>
        <bdi>{suppliers.length}</bdi> ספקים
      </h2>
      <StatusMessage>
        {count < suppliers.length
          ? `מציג ${String(count)} מתוך ${String(suppliers.length)} תוצאות…`
          : 'כל התוצאות מוצגות.'}
      </StatusMessage>
      <ul
        ref={(node) => {
          if (node) return batches.mount();
          return undefined;
        }}
        className={styles.results}
        aria-label="ספקים"
        aria-busy={count < suppliers.length}
      >
        {suppliers.slice(0, count).map((supplier, index) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            today={today}
            deferred={index >= BATCH_SIZE}
            picked={picked.includes(supplier.id) || (full ? null : false)}
          />
        ))}
      </ul>
    </section>
  );
}
