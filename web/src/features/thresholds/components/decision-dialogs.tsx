import { useActionState } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { ConfirmDialog } from '../../../ui/confirm-dialog.tsx';
import { Dialog } from '../../../ui/dialog.tsx';
import { FormActions } from '../../../ui/form-actions.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { DataError } from '../../../data/client.ts';
import { dayOf } from '../../../lib/dates.ts';
import { decideProposal, type Proposal } from '../api/proposals.ts';
import { AMOUNT_LABELS, formatMoney } from '../model/comparison.ts';

export const approveId = (id: string) => `approve-thresholds-${id}`;
export const rejectId = (id: string) => `reject-thresholds-${id}`;

/** Runs a decision; '' on success. 404 means another admin already decided it. */
function useDecide(id: string) {
  const revalidator = useRevalidator();
  return async (approve: boolean): Promise<string> => {
    try {
      await decideProposal(id, approve);
    } catch (error) {
      if (error instanceof DataError && error.status === 404) {
        await revalidator.revalidate().catch(() => undefined);
        return '';
      }
      return error instanceof DataError ? error.message : 'לא ניתן לשמור את ההחלטה.';
    }
    await revalidator.revalidate().catch(() => undefined);
    return '';
  };
}

/** "אישור הספים" asks once more with the amounts: every route check from that day uses them. */
export function ApproveDialog({ proposal }: { proposal: Proposal }) {
  const decide = useDecide(proposal.id);
  const [error, action, pending] = useActionState(async () => {
    const message = await decide(true);
    if (!message) {
      const dialog = document.getElementById(approveId(proposal.id));
      if (dialog instanceof HTMLDialogElement) dialog.close();
    }
    return message;
  }, '');
  const from = dayOf(proposal.valid_from);
  return (
    <Dialog id={approveId(proposal.id)} title={`לאשר את הספים מ-${from}?`}>
      <form action={action} aria-label={`אישור הספים מ-${from}`}>
        <p>מ-{from} כל בדיקת מסלול תשתמש בסכומים האלה:</p>
        <ul>
          {Object.entries(AMOUNT_LABELS).map(([key, label]) => (
            <li key={key}>
              {label}: <bdi>{formatMoney(proposal[key as keyof typeof AMOUNT_LABELS])}</bdi>
            </li>
          ))}
        </ul>
        {error && <Notice tone="error" title={error} />}
        <FormActions>
          <Button type="submit" pending={pending}>
            אישור הספים
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

export function RejectDialog({ proposal }: { proposal: Proposal }) {
  const decide = useDecide(proposal.id);
  return (
    <ConfirmDialog
      id={rejectId(proposal.id)}
      title={`לדחות את ההצעה לספים מ-${dayOf(proposal.valid_from)}?`}
      action={{ label: 'דחיית ההצעה', run: () => decide(false) }}
    >
      <p>הספים הנוכחיים יישארו בתוקף. הצעה חדשה תיווצר עם פרסום המדד הבא.</p>
    </ConfirmDialog>
  );
}
