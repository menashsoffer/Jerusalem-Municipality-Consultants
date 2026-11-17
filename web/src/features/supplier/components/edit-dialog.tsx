import { useState } from 'react';
import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { Button } from '../../../ui/button.tsx';
import { Dialog } from '../../../ui/dialog.tsx';
import { EditForm } from './edit-form.tsx';
import { StatusPanel } from './status-panel.tsx';
import styles from './supplier.module.css';

export const EDIT_DIALOG = 'supplier-edit-dialog';

interface Props {
  data: SupplierDetail;
  editor: boolean;
  admin: boolean;
  today: string;
}

/**
 * Spec section 4.5: one save for the details, and beside it the administrator's status
 * button in its own colour. The dialog closes with the X, Escape or a click outside it.
 */
export function EditDialog({ data, editor, admin, today }: Props) {
  const [confirming, setConfirming] = useState(false);
  const inactive = data.supplier.status === 'inactive';
  const statusButton = admin && (
    <Button
      variant={inactive ? 'secondary' : 'danger'}
      aria-expanded={confirming}
      onClick={() => {
        setConfirming(true);
      }}
    >
      {inactive ? 'סימון כפעיל' : 'סימון כלא פעיל'}
    </Button>
  );
  return (
    <Dialog
      id={EDIT_DIALOG}
      title="עריכת פרטי הספק"
      onClose={() => {
        setConfirming(false);
      }}
    >
      {editor ? (
        <EditForm data={data} aside={statusButton} />
      ) : (
        <div className={styles.dialogActions}>{statusButton}</div>
      )}
      {admin && confirming && (
        <StatusPanel
          data={data}
          today={today}
          cancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </Dialog>
  );
}
