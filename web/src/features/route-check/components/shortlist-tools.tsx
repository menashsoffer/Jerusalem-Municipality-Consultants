import { useState } from 'react';
import { Button } from '../../../ui/button.tsx';
import { FormActions } from '../../../ui/form-actions.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { errorText } from '../../../data/errors.ts';
import { recordApproaches } from '../api/engagement.ts';
import { bccLine, bccMessage, shareLink, type PickedSupplier } from '../model/engagement.ts';

interface Props {
  suppliers: readonly PickedSupplier[];
  today: string;
  requestId: string | null;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The clipboard can be refused; the message then says so instead of claiming a copy. */
function useTools({ suppliers, today, requestId }: Props) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  return {
    message,
    error,
    recording,
    async bcc() {
      const line = bccLine(suppliers);
      if (!line.count) {
        setMessage('לאף ספק בבקשה אין דוא״ל במאגר.');
        return;
      }
      setMessage((await copy(line.text)) ? bccMessage(line) : 'ההעתקה נכשלה.');
    },
    async share() {
      const ok = await copy(shareLink(window.location.href, suppliers));
      setMessage(ok ? 'הקישור הועתק. הוא נפתח רק למשתמשים מחוברים עם הרשאה.' : 'ההעתקה נכשלה.');
    },
    async csv() {
      const { downloadCsv } = await import('../model/csv.ts');
      downloadCsv(suppliers, today);
      setMessage('הקובץ הורד, בלי מספרי זהות.');
    },
    async approach() {
      if (!requestId) return;
      const active = suppliers.filter((s) => !s.inactive).map((s) => s.id);
      setRecording(true);
      try {
        const added = await recordApproaches(requestId, active);
        setError('');
        setMessage(`נרשמו ${String(added)} פניות להיום.`);
      } catch (cause) {
        setError(errorText(cause));
      } finally {
        setRecording(false);
      }
    },
  };
}

/** Step 3 actions: recording the approach is the main one, and only for a saved request. */
export function ShortlistTools(props: Props) {
  const tools = useTools(props);
  return (
    <section aria-label="פעולות על הבקשה">
      {tools.error && <Notice tone="error" title={tools.error} />}
      <FormActions>
        {props.requestId && (
          <Button
            pending={tools.recording}
            pendingLabel="רושם פנייה…"
            data-usage="request.approach"
            onClick={() => void tools.approach()}
          >
            רישום פנייה לספקים
          </Button>
        )}
        <Button variant="secondary" onClick={() => void tools.bcc()} data-usage="request.bcc">
          העתקת כתובות ל-BCC
        </Button>
        <Button variant="secondary" onClick={() => void tools.csv()} data-usage="request.export">
          ייצוא לקובץ
        </Button>
        <Button variant="secondary" onClick={() => void tools.share()} data-usage="request.share">
          העתקת קישור
        </Button>
      </FormActions>
      <StatusMessage>{tools.message}</StatusMessage>
    </section>
  );
}
