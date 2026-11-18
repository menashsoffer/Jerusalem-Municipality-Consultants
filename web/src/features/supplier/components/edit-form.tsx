import { useActionState, useState, type ReactNode } from 'react';
import { useRevalidator } from 'react-router';
import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import type { FieldErrors } from '../../../lib/rules/forms.ts';
import { Button } from '../../../ui/button.tsx';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { IDLE, saveAndRefresh, update, type SaveResult } from '../api/write.ts';
import { CONTACT_KINDS } from '../model/labels.ts';
import { contactField, NAME, NEW_KIND, NEW_VALUE, parseEditForm } from '../model/edit-form.ts';
import styles from './supplier.module.css';

interface Props {
  data: SupplierDetail;
  /** Shown beside the save button: the administrator's status action. */
  aside?: ReactNode;
}
interface State extends SaveResult {
  errors: FieldErrors;
  /** What was typed, so a refused form shows it again instead of the saved values. */
  typed: Record<string, string>;
}
const START: State = { ...IDLE, errors: {}, typed: {} };

function typedValues(form: FormData): Record<string, string> {
  const typed: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === 'string') typed[key] = value;
  });
  return typed;
}

interface ContactsProps {
  data: SupplierDetail;
  errors: FieldErrors;
  typed: Record<string, string>;
}
function Contacts({ data, errors, typed }: ContactsProps) {
  const current = data.contacts.filter((item) => item.status === 'current');
  return (
    <fieldset className={styles.fieldset}>
      <legend>פרטי קשר</legend>
      {current.map((item) => (
        <FormField
          key={item.id}
          field={{
            label: CONTACT_KINDS[item.kind] ?? 'פרט קשר',
            error: errors[contactField(item.id)],
          }}
          input={{
            name: contactField(item.id),
            defaultValue: typed[contactField(item.id)] ?? item.value,
            maxLength: 500,
          }}
        />
      ))}
      <div className={styles.newContact}>
        {/* A select keeps its choice through a form reset; a new key restores the typed one. */}
        <SelectField
          key={typed[NEW_KIND] ?? ''}
          field={{ label: 'פרט קשר חדש', error: errors[NEW_KIND] }}
          select={{
            name: NEW_KIND,
            defaultValue: typed[NEW_KIND] ?? '',
            children: [
              <option key="" value="">
                בחירת סוג
              </option>,
              ...Object.entries(CONTACT_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )),
            ],
          }}
        />
        <FormField
          field={{ label: 'ערך', error: errors[NEW_VALUE] }}
          input={{ name: NEW_VALUE, defaultValue: typed[NEW_VALUE] ?? '', maxLength: 500 }}
        />
      </div>
    </fieldset>
  );
}

/**
 * One form, one save (spec 4.5): the shared rules check every field first and mark each
 * mistake beside it; the database checks the same rules again and stores all or nothing.
 */
export function EditForm({ data, aside }: Props) {
  const revalidator = useRevalidator();
  const [version, setVersion] = useState(0);
  const [state, action, pending] = useActionState(async (_: State, form: FormData) => {
    const parsed = parseEditForm(form, data);
    if ('errors' in parsed)
      return {
        ...IDLE,
        error: 'יש לתקן את השדות המסומנים.',
        errors: parsed.errors,
        typed: typedValues(form),
      };
    if ('unchanged' in parsed) return { ...START, message: 'אין שינויים לשמירה.' };
    const result = await saveAndRefresh(
      update(parsed.update),
      () => revalidator.revalidate(),
      'השינויים נשמרו.',
    );
    if (!result.error) setVersion((value) => value + 1);
    return { ...result, errors: {}, typed: result.error ? typedValues(form) : {} };
  }, START);
  return (
    <form action={action} aria-label="עריכת פרטי הספק" key={version} noValidate>
      <FormField
        field={{ label: 'שם הספק', error: state.errors[NAME] }}
        input={{
          name: NAME,
          defaultValue: state.typed[NAME] ?? data.supplier.display_name,
          required: true,
          maxLength: 300,
        }}
      />
      <Contacts data={data} errors={state.errors} typed={state.typed} />
      <div className={styles.dialogActions}>
        <Button type="submit" pending={pending}>
          שמירה
        </Button>
        {aside}
      </div>
      <StatusMessage>{pending ? 'שומר…' : state.message}</StatusMessage>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
