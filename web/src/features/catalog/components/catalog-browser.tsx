import { useDeferredValue, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { FormField } from '../../../ui/form-field.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { filterCatalog } from '../../../catalog-filter.ts';
import type { CatalogState } from '../../../data/snapshot.ts';
import { emptyFilters, reconcile, changeFilter } from '../model/filters.ts';
import { restoreFilters, saveFilters } from '../model/saved-filters.ts';
import { clearFilters, withoutTag } from '../model/filter-groups.ts';
import { FilterControls } from './filter-controls.tsx';
import { ActiveFilters } from './active-filters.tsx';
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

function SearchBox({ value, change }: { value: string; change: (query: string) => void }) {
  return (
    <FormField
      field={{ label: 'חיפוש ספקים', hint: 'אפשר לחפש בשם ספק, בשם קודם או בתחום.' }}
      input={{
        type: 'search',
        value,
        onChange: (e) => {
          change(e.currentTarget.value);
        },
      }}
    />
  );
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
        <SearchBox
          value={filters.query}
          change={(query) => {
            setFilters({ ...current, query });
          }}
        />
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
        <ActiveFilters
          filters={current}
          suppliers={state.suppliers}
          remove={(key) => {
            setFilters(withoutTag(current, key));
          }}
          clear={() => {
            setFilters(clearFilters(current));
          }}
        />
      </search>
      <div aria-busy={query !== filters.query}>
        <Results
          key={`${state.version}:${JSON.stringify({ ...current, query })}`}
          suppliers={matches}
          today={today}
          reset={() => {
            setFilters(emptyFilters(today));
          }}
        />
      </div>
    </>
  );
}
