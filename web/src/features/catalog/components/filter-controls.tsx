// The filter row (screens-spec-he.md 1): four filters in view and "עוד מסננים" for the rest.
// On a phone the row is one "סינון" button that opens every filter in a bottom sheet.
import { SelectField } from '../../../ui/select-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { Dialog } from '../../../ui/dialog.tsx';
import { useNarrow } from '../../../lib/use-narrow.ts';
import type { Filters } from '../../../catalog-filter.ts';
import type { Supplier } from '../../../catalog-model.ts';
import { optionsFor, type FilterKey, type ToggleKey } from '../model/filters.ts';
import {
  choicesFor,
  countSet,
  LABELS,
  MORE,
  PRIMARY,
  TOGGLES,
  type Options,
} from '../model/filter-groups.ts';
import styles from './catalog.module.css';
import { usage } from '../../../lib/usage-signal.ts';

interface Props {
  filters: Filters;
  suppliers: Supplier[];
  change: (key: FilterKey, value: string) => void;
  toggle: (key: ToggleKey, value: boolean) => void;
}
const SHEET = 'catalog-filters';

function Control({ name, options, ...props }: Props & { name: FilterKey; options: Options }) {
  const { filters } = props;
  const choices = choicesFor(name, options);
  const disabled = name === 'subcategory' && (!filters.category || choices.length === 0);
  return (
    <SelectField
      field={{ label: LABELS[name] }}
      select={{
        ...usage(`catalog.filter.${name}`),
        value: filters[name],
        disabled,
        onChange: (e) => {
          props.change(name, e.currentTarget.value);
        },
        children: (
          <>
            <option value="">הכול</option>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </>
        ),
      }}
    />
  );
}

function Controls({ keys, ...props }: Props & { keys: readonly FilterKey[] }) {
  const options = optionsFor(props.suppliers, props.filters);
  return keys.map((key) => <Control key={key} name={key} options={options} {...props} />);
}

function Toggles({ filters, toggle }: Pick<Props, 'filters' | 'toggle'>) {
  return TOGGLES.map(({ key, label }) => (
    <label key={key} className={styles.toggle}>
      <input
        data-usage={`catalog.toggle.${key}`}
        type="checkbox"
        checked={filters[key]}
        onChange={(e) => {
          toggle(key, e.currentTarget.checked);
        }}
      />
      {label}
    </label>
  ));
}

function Sheet({ title, keys, ...props }: Props & { title: string; keys: readonly FilterKey[] }) {
  return (
    <Dialog id={SHEET} title={title}>
      <div className={styles.sheetFilters}>
        <Controls keys={keys} {...props} />
        <Toggles filters={props.filters} toggle={props.toggle} />
      </div>
      <div className={styles.sheetActions}>
        <Button data-usage="catalog.filters-apply" command={{ target: SHEET, action: 'close' }}>
          הצגת התוצאות
        </Button>
      </div>
    </Dialog>
  );
}

function Opener({ label, count }: { label: string; count: number }) {
  return (
    <Button
      variant="secondary"
      className={styles.moreButton}
      data-usage="catalog.filters-open"
      command={{ target: SHEET, action: 'show-modal' }}
    >
      {label}
      {count > 0 && ` (${String(count)})`}
    </Button>
  );
}

export function FilterControls(props: Props) {
  const narrow = useNarrow();
  if (narrow) {
    const all = [...PRIMARY, ...MORE];
    return (
      <div className={styles.filterRow}>
        <Opener label="סינון" count={countSet(props.filters, all, true)} />
        <Sheet title="סינון" keys={all} {...props} />
      </div>
    );
  }
  return (
    <div className={styles.filterRow}>
      <div className={styles.filters}>
        <Controls keys={PRIMARY} {...props} />
      </div>
      <Opener label="עוד מסננים" count={countSet(props.filters, MORE, true)} />
      <Sheet title="עוד מסננים" keys={MORE} {...props} />
    </div>
  );
}
