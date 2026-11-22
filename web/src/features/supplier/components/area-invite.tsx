import { useActionState } from 'react';
import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { Button } from '../../../ui/button.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { areaLink, inviteToArea } from '../api/invite.ts';
import styles from './supplier.module.css';

interface State {
  error: string;
  sent: string;
}

/** Staff invite one of the supplier's own emails to the supplier area (spec 6.10). */
export function AreaInvite({ data }: { data: SupplierDetail }) {
  const emails = data.contacts.filter((c) => c.kind === 'email' && c.is_valid).map((c) => c.value);
  const [state, action, pending] = useActionState(
    async (_previous: State, form: FormData): Promise<State> => {
      const value = form.get('email');
      const email = typeof value === 'string' ? value : '';
      const error = await inviteToArea(data.supplier.id, email);
      return { error, sent: error ? '' : email };
    },
    { error: '', sent: '' },
  );
  if (emails.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="supplier-area-invite">
      <h2 id="supplier-area-invite">האזור האישי</h2>
      <form action={action} aria-label="הזמנה לאזור האישי">
        <SelectField
          field={{ label: 'דוא"ל להזמנה', hint: 'רק דוא"ל שכבר רשום לספק' }}
          select={{
            name: 'email',
            required: true,
            children: emails.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            )),
          }}
        />
        <Button type="submit" variant="secondary" pending={pending} pendingLabel="שומר…">
          הזמנה לאזור האישי
        </Button>
      </form>
      {state.error && <Notice tone="error" title={state.error} />}
      {state.sent && (
        <Notice tone="success" title={`ההזמנה ל-${state.sent} נשמרה, בתוקף 14 יום.`}>
          המערכת לא שולחת דוא"ל. שלחו לספק את הקישור {areaLink()} והוא ייכנס עם הכתובת הזו.
        </Notice>
      )}
    </section>
  );
}
