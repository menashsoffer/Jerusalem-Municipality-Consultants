import { SelectField } from '../../../ui/select-field.tsx';
import { Button } from '../../../ui/button.tsx';
import type { EngagementRequest } from '../api/check.ts';
interface Props {
  requests: EngagementRequest[];
  selection: { value: string; change: (id: string) => void };
  next: () => void;
}
export function RequestChoice({ requests, selection, next }: Props) {
  return (
    <form action={next} aria-label="בחירת בקשת התקשרות">
      <SelectField
        field={{ label: 'בקשת התקשרות', hint: 'הבדיקה מתבססת על הנתונים והראיות שנשמרו בבקשה.' }}
        select={{
          name: 'request_id',
          value: selection.value,
          required: true,
          onChange: (e) => {
            selection.change(e.currentTarget.value);
          },
          children: (
            <>
              <option value="">בחירת בקשה</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.subject}
                </option>
              ))}
            </>
          ),
        }}
      />
      <Button type="submit">המשך לבדיקת הנתונים</Button>
    </form>
  );
}
