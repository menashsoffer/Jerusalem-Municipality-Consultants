import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { AreaInvite } from './area-invite.tsx';
import { ContactCard } from './contact-card.tsx';
import { EditDialog } from './edit-dialog.tsx';
import { SupplierHeader } from './header.tsx';
import { History } from './history.tsx';
import { IdentityCard, Sources } from './identity-card.tsx';
import { Listings } from './listings.tsx';
import { PendingChanges } from './pending-changes.tsx';
import type { ChangeRequest } from '../../../data/supplier-changes.ts';
import styles from './supplier.module.css';

interface Props {
  data: SupplierDetail;
  today: string;
  editor?: boolean;
  admin?: boolean;
  /** Waiting changes the signed-in person may see, and who that person is. */
  pending?: { changes: readonly ChangeRequest[]; userId: string | null };
}

/** The supplier screen (documentation/supplier-page-spec-he.md): header, listings, side cards. */
export function SupplierDetails({ data, today, editor = false, admin = false, pending }: Props) {
  return (
    <>
      <SupplierHeader data={data} editor={editor || admin} />
      <div className={styles.columns}>
        <Listings data={data} today={today} />
        <div className={styles.side}>
          <ContactCard contacts={data.contacts} />
          <IdentityCard data={data} />
          <Sources data={data} />
          {(editor || admin) && data.supplier.status === 'active' && (
            <AreaInvite data={data} admin={admin} />
          )}
        </div>
      </div>
      {pending && (
        <PendingChanges
          changes={pending.changes}
          userId={pending.userId}
          admin={admin}
          editor={editor}
        />
      )}
      <History audit={data.audit} />
      {(editor || admin) && <EditDialog data={data} editor={editor} admin={admin} today={today} />}
    </>
  );
}
