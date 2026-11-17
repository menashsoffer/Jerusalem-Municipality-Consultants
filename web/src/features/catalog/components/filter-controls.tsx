import { SelectField } from '../../../ui/select-field.tsx';
import type { Filters } from '../../../catalog-filter.ts';
import type { Supplier } from '../../../catalog-model.ts';
import { optionsFor, type Choice, type FilterKey } from '../model/filters.ts';
import styles from './catalog.module.css';
interface Props {
  filters: Filters;
  suppliers: Supplier[];
  change: (key: FilterKey, value: string) => void;
}
interface ControlProps {
  label: string;
  value: string;
  choices: Choice[];
  disabled?: boolean;
  change: (value: string) => void;
}
function Control({ label, value, choices, disabled, change }: ControlProps) {
  return (
    <SelectField
      field={{ label }}
      select={{
        value,
        disabled,
        onChange: (e) => {
          change(e.currentTarget.value);
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
const KEYS = ['registry', 'field', 'category', 'subcategory', 'unit', 'validity'] as const;
const LABELS = {
  registry: 'מאגר',
  field: 'תחום',
  category: 'קטגוריה',
  subcategory: 'תת־קטגוריה',
  unit: 'יחידה',
  validity: 'תוקף',
};
const VALIDITY_CHOICES = [
  { value: 'valid', label: 'בתוקף' },
  { value: 'expired', label: 'פג תוקף' },
  { value: 'undated', label: 'ללא תאריך סיום' },
  { value: 'future', label: 'טרם החל' },
];
export function FilterControls({ filters, suppliers, change }: Props) {
  const options = optionsFor(suppliers, filters);
  return (
    <details className={styles.disclosure}>
      <summary>סינון תוצאות</summary>
      <div className={styles.filters}>
        {KEYS.map((key) => (
          <Control
            key={key}
            label={LABELS[key]}
            value={filters[key]}
            choices={key === 'validity' ? VALIDITY_CHOICES : options[key]}
            disabled={
              key === 'subcategory' && (!filters.category || options.subcategory.length === 0)
            }
            change={(value) => {
              change(key, value);
            }}
          />
        ))}
      </div>
    </details>
  );
}
