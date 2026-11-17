import { Button } from '../../../ui/button.tsx';
import { approachLabel, type PickedSupplier } from '../model/engagement.ts';

interface Props {
  suppliers: readonly PickedSupplier[];
  remove: (id: string) => void;
}

export function PickedList({ suppliers, remove }: Props) {
  return (
    <ul aria-label="ספקים בבקשה">
      {suppliers.map((supplier) => (
        <li key={supplier.id}>
          <strong>{supplier.name}</strong>
          {supplier.inactive && <span> · לא פעיל, לא ניתן לפנות אליו</span>}
          <span> · {approachLabel(supplier.lastApproached)}</span>
          <span> · {supplier.emails.length ? 'יש דוא״ל' : 'אין דוא״ל במאגר'}</span>{' '}
          <Button
            aria-label={`הסרה מהבקשה: ${supplier.name}`}
            onClick={() => {
              remove(supplier.id);
            }}
          >
            הסרה
          </Button>
        </li>
      ))}
    </ul>
  );
}
