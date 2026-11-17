import type { Candidate } from '../model/duplicates.ts';
import { OFFERED_FIELD } from '../model/add-form.ts';

/**
 * Similar names are a hint, not proof of the same supplier, so the user decides: an existing
 * supplier, or a new one anyway. The radio group is required whenever it is shown.
 */
export function DuplicateChoices({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) return null;
  const options = [
    ...candidates.map((item) => ({
      id: item.id,
      label: `${item.name}${item.identifierMatch ? ' · מזהה זהה' : ''}`,
    })),
    { id: 'new', label: 'יצירת ספק חדש בכל זאת' },
  ];
  return (
    <fieldset>
      <legend>נמצאו ספקים דומים. בחרו ספק קיים או יצירה חדשה</legend>
      {/* Tells the form handler that a choice was offered, so an empty choice is refused. */}
      <input type="hidden" name={OFFERED_FIELD} value="1" />
      {options.map((option) => (
        <label key={option.id}>
          <input type="radio" name="supplier_choice" value={option.id} required />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
