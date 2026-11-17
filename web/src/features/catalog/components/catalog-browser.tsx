import { useState, useDeferredValue } from 'react';
import { FormField } from '../../../ui/form-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { filterCatalog } from '../../../catalog-filter.ts';
import type { CatalogState } from '../../../data/snapshot.ts';
import { emptyFilters, reconcile, changeFilter } from '../model/filters.ts';
import { FilterControls } from './filter-controls.tsx';
import { Results } from './results.tsx';
import styles from './catalog.module.css';
interface Props {
  state: CatalogState;
  today: string;
}
export function CatalogBrowser({ state, today }: Props) {
  const [filters, setFilters] = useState(() => emptyFilters(today));
  const current = reconcile(filters, state.suppliers),
    query = useDeferredValue(filters.query);
  const matches = filterCatalog(state.suppliers, { ...current, query });
  return (
    <>
      <StatusMessage>{state.refreshing ? 'בודק עדכונים והרשאות…' : ''}</StatusMessage>
      <search aria-label="חיפוש וסינון ספקים" className={styles.searchPanel}>
        <FormField
          field={{ label: 'חיפוש ספקים', hint: 'אפשר לחפש בשם ספק, בשם קודם או בתחום.' }}
          input={{
            type: 'search',
            value: filters.query,
            onChange: (e) => {
              setFilters({ ...current, query: e.currentTarget.value });
            },
          }}
        />
        <div className={styles.searchTools}>
          <FilterControls
            filters={current}
            suppliers={state.suppliers}
            change={(key, value) => {
              setFilters(changeFilter(current, { key, value }, state.suppliers));
            }}
            toggle={(key, value) => {
              setFilters({ ...current, [key]: value });
            }}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(emptyFilters(today));
            }}
          >
            ניקוי החיפוש והמסננים
          </Button>
        </div>
      </search>
      <div aria-busy={query !== filters.query}>
        <Results
          key={`${state.version}:${JSON.stringify({ ...current, query })}`}
          suppliers={matches}
          today={today}
        />
      </div>
    </>
  );
}
