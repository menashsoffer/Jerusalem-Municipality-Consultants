import { useDeferredValue, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { FormField } from '../../../ui/form-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { filterCatalog } from '../../../catalog-filter.ts';
import type { CatalogState } from '../../../data/snapshot.ts';
import { emptyFilters, reconcile, changeFilter } from '../model/filters.ts';
import { restoreFilters, saveFilters } from '../model/saved-filters.ts';
import { FilterControls } from './filter-controls.tsx';
import { Results } from './results.tsx';
import styles from './catalog.module.css';
interface Props {
  state: CatalogState;
  today: string;
}
/** The search survives a visit to a supplier and the way back (supplier page spec, section 3). */
function useSavedFilters(today: string) {
  const { key } = useLocation();
  const state = useState(() => restoreFilters(key, emptyFilters(today)) ?? emptyFilters(today));
  const [filters] = state;
  useEffect(() => {
    saveFilters(key, filters);
  }, [key, filters]);
  return state;
}

export function CatalogBrowser({ state, today }: Props) {
  const [filters, setFilters] = useSavedFilters(today);
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
