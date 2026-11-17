import { useState } from 'react';
import { Button } from '../../../ui/button.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { DataError } from '../../../data/client.ts';
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
  return {
    message,
    error,
    async bcc() {
      const line = bccLine(suppliers);
      if (!line.count) {
        setMessage('לאף ספק בבקשה אין דוא״ל במאגר.');
        return;
      }
      setMessage((await copy(line.text)) ? bccMessage(line) : 'ההעתקה נכשלה.');
    },
    async share() {
      const ok = await copy(shareLink(window.location.origin, suppliers));
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
      try {
        const added = await recordApproaches(requestId, active);
        setError('');
        setMessage(`נרשמו ${String(added)} פניות להיום.`);
      } catch (cause) {
        setError(cause instanceof DataError ? cause.message : 'רישום הפנייה נכשל.');
      }
    },
  };
}

export function ShortlistTools(props: Props) {
  const tools = useTools(props);
  return (
    <section aria-label="פעולות על הבקשה">
      <Button onClick={() => void tools.bcc()}>העתקת כתובות ל-BCC</Button>{' '}
      <Button onClick={() => void tools.csv()}>ייצוא CSV</Button>{' '}
      <Button onClick={() => void tools.share()}>העתקת קישור לרשימה</Button>{' '}
      {props.requestId && (
        <Button onClick={() => void tools.approach()}>רישום פנייה לספקים הפעילים</Button>
      )}
      <StatusMessage>{tools.message}</StatusMessage>
      {tools.error && <p role="alert">{tools.error}</p>}
    </section>
  );
}
