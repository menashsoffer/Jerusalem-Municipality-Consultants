import { useActionState, useState } from 'react';
import { useRevalidator } from 'react-router';
import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { Button } from '../../../ui/button.tsx';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { IDLE, contact, rename, saveAndRefresh, type SaveResult } from '../api/write.ts';
import { CONTACT_KINDS } from '../model/labels.ts';
import { formText } from '../model/add-form.ts';

interface Props {
  data: SupplierDetail;
}

function Outcome({ pending, result }: { pending: boolean; result: SaveResult }) {
  return (
    <>
      <StatusMessage>{pending ? 'שומר…' : result.message}</StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </>
  );
}

function useSave() {
  const revalidator = useRevalidator();
  return (request: (token: string) => Promise<string>, saved: string) =>
    saveAndRefresh(request, () => revalidator.revalidate(), saved);
}

function NameForm({ data }: Props) {
  const save = useSave();
  const [result, action, pending] = useActionState(async (_: SaveResult, form: FormData) => {
    const name = formText(form, 'display_name');
    if (!name) return { message: '', error: 'יש למלא את שם הספק.' };
    return save(rename(data.supplier.id, name), 'השם נשמר.');
  }, IDLE);
  return (
    <form action={action} aria-label="שינוי שם הספק">
      <FormField
        field={{ label: 'שם הספק' }}
        input={{
          name: 'display_name',
          defaultValue: data.supplier.display_name,
          required: true,
          maxLength: 300,
        }}
      />
      <Button type="submit" disabled={pending}>
        שמירת שם
      </Button>
      <Outcome pending={pending} result={result} />
    </form>
  );
}

interface KindProps {
  current: SupplierDetail['contacts'];
  chosen: string;
  choose: (id: string) => void;
}
/** Picking an existing contact locks its kind; only its value can change. */
function ContactKind({ current, chosen, choose }: KindProps) {
  const existing = current.find((item) => item.id === chosen);
  return (
    <>
      <SelectField
        field={{ label: 'פרט קשר קיים' }}
        select={{
          value: chosen,
          onChange: (event) => {
            choose(event.currentTarget.value);
          },
          children: [
            <option key="" value="">
              פרט קשר חדש
            </option>,
            ...current.map((item) => (
              <option key={item.id} value={item.id}>
                {`${CONTACT_KINDS[item.kind] ?? 'פרט קשר'}: ${item.value}`}
              </option>
            )),
          ],
        }}
      />
      <SelectField
        field={{ label: 'סוג' }}
        select={{
          name: 'kind',
          disabled: !!existing,
          ...(existing ? { value: existing.kind } : {}),
          children: Object.entries(CONTACT_KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          )),
        }}
      />
    </>
  );
}

function ContactForm({ data }: Props) {
  const save = useSave();
  const current = data.contacts.filter((item) => item.status === 'current');
  const [chosen, choose] = useState('');
  const existing = current.find((item) => item.id === chosen);
  const [result, action, pending] = useActionState(async (_: SaveResult, form: FormData) => {
    const value = formText(form, 'value');
    if (!value) return { message: '', error: 'יש למלא ערך.' };
    const kind = existing?.kind ?? formText(form, 'kind');
    const change = { supplierId: data.supplier.id, contactId: chosen, kind, value };
    return save(contact(change), 'פרט הקשר נשמר.');
  }, IDLE);
  return (
    <form action={action} aria-label="הוספה או עדכון פרט קשר">
      <h3>הוספה או עדכון פרט קשר</h3>
      <ContactKind current={current} chosen={chosen} choose={choose} />
      {/* A new key resets the value whenever the chosen contact changes. */}
      <FormField
        key={chosen}
        field={{ label: 'ערך' }}
        input={{
          name: 'value',
          defaultValue: existing?.value ?? '',
          required: true,
          maxLength: 500,
        }}
      />
      <Button type="submit" disabled={pending}>
        שמירת פרט קשר
      </Button>
      <Outcome pending={pending} result={result} />
    </form>
  );
}

/** Shown to editors only. The database checks the unit grant again on every write. */
export function EditForms({ data }: Props) {
  return (
    <section aria-labelledby="supplier-edit">
      <h2 id="supplier-edit">עריכת פרטי הספק</h2>
      <NameForm data={data} />
      <ContactForm data={data} />
    </section>
  );
}
