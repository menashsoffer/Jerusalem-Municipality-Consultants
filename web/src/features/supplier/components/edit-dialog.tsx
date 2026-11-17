import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { Dialog } from '../../../ui/dialog.tsx';
import { EditForms } from './edit-forms.tsx';
import { StatusForm } from './status-form.tsx';

export const EDIT_DIALOG = 'supplier-edit-dialog';

interface Props {
  data: SupplierDetail;
  editor: boolean;
  admin: boolean;
  today: string;
}

/** Spec section 4.5: editing lives in a dialog; marking inactive is for administrators. */
export function EditDialog({ data, editor, admin, today }: Props) {
  return (
    <Dialog id={EDIT_DIALOG} title="עריכת פרטי הספק">
      {editor && <EditForms data={data} />}
      {admin && <StatusForm data={data} today={today} />}
    </Dialog>
  );
}
