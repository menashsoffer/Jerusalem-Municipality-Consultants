import { SelectField } from '../../../ui/select-field.tsx';
import type { Filters } from '../../../catalog-filter.ts';
import type { Supplier } from '../../../catalog-model.ts';
import { optionsFor, type Choice, type FilterKey, type ToggleKey } from '../model/filters.ts';
import styles from './catalog.module.css';
interface Props {
  filters: Filters;
  suppliers: Supplier[];
  change: (key: FilterKey, value: string) => void;
  toggle: (key: ToggleKey, value: boolean) => void;
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
const KEYS = [
  'registry',
  'field',
  'category',
  'subcategory',
  'unit',
  'validity',
  'identifier',
] as const;
const LABELS = {
  registry: 'מאגר',
  field: 'תחום',
  category: 'קטגוריה',
  subcategory: 'תת־קטגוריה',
  unit: 'יחידה',
  validity: 'תוקף',
  identifier: 'ח.פ.',
};
const VALIDITY_CHOICES = [
  { value: 'valid', label: 'בתוקף' },
  { value: 'expired', label: 'פג תוקף' },
  { value: 'undated', label: 'ללא תאריך סיום' },
  { value: 'future', label: 'טרם החל' },
];
const IDENTIFIER_CHOICES = [
  { value: 'verified', label: 'ח.פ. מאושר' },
  { value: 'pending', label: 'ח.פ. ממתין לאישור' },
  { value: 'none', label: 'אין ח.פ. מאושר' },
];
const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'showInactive', label: 'להציג גם ספקים לא פעילים' },
  { key: 'showClosed', label: 'להציג גם מאגרים סגורים וגרסאות קודמות' },
];
function fixedChoices(key: (typeof KEYS)[number]): Choice[] | null {
  if (key === 'validity') return VALIDITY_CHOICES;
  return key === 'identifier' ? IDENTIFIER_CHOICES : null;
}
export function FilterControls({ filters, suppliers, change, toggle }: Props) {
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
            choices={
              fixedChoices(key) ?? options[key as Exclude<typeof key, 'validity' | 'identifier'>]
            }
            disabled={
              key === 'subcategory' && (!filters.category || options.subcategory.length === 0)
            }
            change={(value) => {
              change(key, value);
            }}
          />
        ))}
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className={styles.toggle}>
            <input
              type="checkbox"
              checked={filters[key]}
              onChange={(e) => {
                toggle(key, e.currentTarget.checked);
              }}
            />
            {label}
          </label>
        ))}
      </div>
    </details>
  );
}
