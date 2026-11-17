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
  'venue',
] as const;
const LABELS = {
  registry: 'מאגר',
  field: 'תחום',
  category: 'קטגוריה',
  subcategory: 'תת־קטגוריה',
  unit: 'יחידה',
  validity: 'תוקף',
  identifier: 'ח.פ.',
  venue: 'מתקנים ואולמות',
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
const VENUE_CHOICES = [
  { value: 'venue', label: 'כל המתקנים' },
  { value: '100', label: 'לפחות 100 מקומות' },
  { value: '200', label: 'לפחות 200 מקומות' },
  { value: '400', label: 'לפחות 400 מקומות' },
];
const FIXED = {
  validity: VALIDITY_CHOICES,
  identifier: IDENTIFIER_CHOICES,
  venue: VENUE_CHOICES,
};
type Listed = Exclude<(typeof KEYS)[number], keyof typeof FIXED>;
function choicesFor(key: (typeof KEYS)[number], options: Record<Listed, Choice[]>): Choice[] {
  return key in FIXED ? FIXED[key as keyof typeof FIXED] : options[key as Listed];
}
const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'showInactive', label: 'להציג גם ספקים לא פעילים' },
  { key: 'showClosed', label: 'להציג גם מאגרים סגורים וגרסאות קודמות' },
];
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
            choices={choicesFor(key, options)}
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
