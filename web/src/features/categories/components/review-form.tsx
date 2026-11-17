import { useActionState } from 'react';
import { useRevalidator } from 'react-router';
import { FormField } from '../../../ui/form-field.tsx';
import { SelectField } from '../../../ui/select-field.tsx';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { decideRequest } from '../api/requests.ts';
interface Props {
  id: string;
  name: string;
  own: boolean;
  categories: { id: string; name: string }[];
}
export function ReviewForm({ id, name, own, categories }: Props) {
  const refresh = useRevalidator();
  const [result, action, pending] = useActionState(
    (_previous: { error: string; committed: boolean }, form: FormData) =>
      decideRequest(id, form, () => refresh.revalidate()),
    { error: '', committed: false },
  );
  const disabled = pending || result.committed;
  return (
    <form action={action} aria-label={`החלטה על ${name}`}>
      <ReviewChoice own={own} categories={categories} disabled={disabled} />
      <FormField
        field={{ label: 'נימוק להחלטה', hint: 'נימוק נדרש בעת דחייה.' }}
        input={{ name: 'note', disabled }}
      />
      <DecisionButtons own={own} disabled={disabled} hasCategories={categories.length > 0} />
      <StatusMessage>
        {pending ? 'שומר החלטה…' : result.committed ? 'ההחלטה נשמרה.' : ''}
      </StatusMessage>
      {result.error && <p role="alert">{result.error}</p>}
    </form>
  );
}

function ReviewChoice({
  own,
  categories,
  disabled,
}: Pick<Props, 'own' | 'categories'> & { disabled: boolean }) {
  return (
    <>
      {own ? (
        <p>מנהל אחר צריך לאשר או לקשר בקשה שיצרת. אפשר לדחות אותה בעצמך.</p>
      ) : (
        <SelectField
          field={{ label: 'קטגוריה קיימת לקישור' }}
          select={{
            name: 'category_id',
            disabled,
            children: (
              <>
                <option value="">בחירת קטגוריה</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </>
            ),
          }}
        />
      )}
    </>
  );
}
function DecisionButtons({
  own,
  disabled,
  hasCategories,
}: {
  own: boolean;
  disabled: boolean;
  hasCategories: boolean;
}) {
  return (
    <>
      {!own && (
        <>
          <Button type="submit" name="decision" value="approved" disabled={disabled}>
            אישור ויצירת קטגוריה
          </Button>{' '}
          <Button
            type="submit"
            name="decision"
            value="linked"
            disabled={disabled || !hasCategories}
          >
            קישור לקטגוריה קיימת
          </Button>{' '}
        </>
      )}
      <Button type="submit" name="decision" value="rejected" disabled={disabled}>
        דחיית הבקשה
      </Button>
    </>
  );
}
