import { useActionState, useState } from 'react';
import type { RegistryOption, WriteContext } from '../../../data/write-context.ts';
import { Button } from '../../../ui/button.tsx';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { membership, saveAndRefresh } from '../api/write.ts';
import { parseAddForm, fieldsOf, versionLabel } from '../model/add-form.ts';
import { duplicates } from '../model/duplicates.ts';
import { ENTITY_KINDS, ID_TYPES } from '../model/labels.ts';
import { DuplicateChoices } from './duplicate-choices.tsx';

interface Result {
  message: string;
  error: string;
  saved: number;
}
const options = (entries: [string, string][]) =>
  entries.map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
const POOL_GROUPS: [boolean, string][] = [
  [true, 'מאגרים פעילים'],
  [false, 'מאגרים שמעמדם טרם אומת'],
];
/** Pools grouped by whether their status is confirmed; an empty group is left out. */
function poolOptions(versions: RegistryOption[]) {
  return POOL_GROUPS.map(([known, label]) => {
    const rows = versions.filter((v) => v.statusKnown === known);
    if (rows.length === 0) return null;
    return (
      <optgroup key={label} label={label}>
        {options(rows.map((v): [string, string] => [v.versionId, versionLabel(v)]))}
      </optgroup>
    );
  });
}
const MANUAL_ID_TYPES = Object.entries(ID_TYPES).filter(([key]) => key !== 'personal_id');

function PoolFields({ context }: { context: WriteContext }) {
  const [versionId, setVersion] = useState('');
  const fields = fieldsOf(context, versionId);
  return (
    <>
      <SelectField
        field={{ label: 'מאגר וגרסה' }}
        select={{
          name: 'registry_version_id',
          required: true,
          value: versionId,
          onChange: (event) => {
            setVersion(event.currentTarget.value);
          },
          children: [options([['', 'בחרו מאגר']]), poolOptions(context.versions)],
        }}
      />
      <SelectField
        key={versionId}
        field={{ label: 'תחום' }}
        select={{
          name: 'registry_field_id',
          required: true,
          disabled: !versionId,
          children: options([
            ['', versionId ? 'בחרו תחום' : 'בחרו תחילה מאגר'],
            ...fields.map((f): [string, string] => [f.id, f.source_text]),
          ]),
        }}
      />
    </>
  );
}

function DatesAndContacts() {
  return (
    <>
      <FormField
        field={{ label: 'תחילת רישום' }}
        input={{ name: 'registered_from', type: 'date' }}
      />
      <FormField
        field={{ label: 'סיום רישום' }}
        input={{ name: 'registered_until', type: 'date' }}
      />
      <FormField
        field={{ label: 'תחילת התקשרות' }}
        input={{ name: 'engagement_started_on', type: 'date' }}
      />
      <FormField field={{ label: 'טלפון' }} input={{ name: 'phone', type: 'tel', maxLength: 80 }} />
      <FormField
        field={{ label: 'דוא״ל' }}
        input={{ name: 'email', type: 'email', maxLength: 160, autoComplete: 'off' }}
      />
    </>
  );
}

function Fields({ context }: { context: WriteContext }) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  return (
    <>
      <FormField
        field={{ label: 'שם ספק' }}
        input={{
          name: 'display_name',
          required: true,
          maxLength: 160,
          onChange: (e) => {
            setName(e.currentTarget.value);
          },
        }}
      />
      <SelectField
        field={{ label: 'סוג ישות' }}
        select={{ name: 'entity_kind', children: options(Object.entries(ENTITY_KINDS)) }}
      />
      <SelectField
        field={{ label: 'סוג מזהה' }}
        select={{
          name: 'identifier_scheme',
          children: options([['', 'ללא מזהה'], ...MANUAL_ID_TYPES]),
        }}
      />
      <FormField
        field={{ label: 'מזהה רשמי', hint: '5 עד 9 ספרות, בלי מקפים. ממלאים יחד עם סוג המזהה.' }}
        input={{
          name: 'identifier',
          inputMode: 'numeric',
          pattern: '[0-9]{5,9}',
          maxLength: 9,
          onChange: (e) => {
            setIdentifier(e.currentTarget.value);
          },
        }}
      />
      <DuplicateChoices candidates={duplicates(context, name, identifier)} />
      <PoolFields context={context} />
      <DatesAndContacts />
    </>
  );
}

/** A saved form remounts its fields (new key), which clears every value and duplicate hint. */
export function AddForm({ context }: { context: WriteContext }) {
  const [result, action, pending] = useActionState(
    async (previous: Result, form: FormData): Promise<Result> => {
      const parsed = parseAddForm(form);
      if (!parsed.payload) return { ...previous, message: '', error: parsed.error };
      const outcome = await saveAndRefresh(
        membership(parsed.payload),
        () => Promise.resolve(),
        'הרישום נשמר וממתין לאימות.',
      );
      return { ...outcome, saved: previous.saved + (outcome.error ? 0 : 1) };
    },
    { message: '', error: '', saved: 0 },
  );
  return (
    <form action={action} aria-label="הוספת ספק למאגר">
      <Fields key={result.saved} context={context} />
      <Button type="submit" disabled={pending || context.versions.length === 0}>
        שמירה
      </Button>
      <StatusMessage>{pending ? 'שומר…' : result.message}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}
