// "פניות ותשובות" of a saved request (supplier-approaches-spec-he.md 6.2). Before the deadline
// an offer shows only that it came; the database holds back its amount, note and file.
import { useEffect, useState } from 'react';
import { Button } from '../../../ui/button.tsx';
import { DataTable } from '../../../ui/data-table.tsx';
import { EmptyState } from '../../../ui/empty-state.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { StatusMessage } from '../../../ui/status-message.tsx';
import { errorText } from '../../../data/errors.ts';
import { signedFileUrl } from '../../../data/files.ts';
import { loadRequestApproaches, type RequestApproach } from '../api/approaches.ts';
import {
  answerText,
  CHANNEL_LABELS,
  comparable,
  opensOn,
  shortDay,
  VAT_RATE,
} from '../model/approaches.ts';

export const REQUEST_APPROACHES = 'request-approaches';

const COLUMNS = [
  { id: 'supplier', label: 'ספק' },
  { id: 'channel', label: 'ערוץ' },
  { id: 'sent', label: 'נשלחה' },
  { id: 'due', label: 'מועד' },
  { id: 'answer', label: 'תשובה' },
  { id: 'file', label: 'קובץ', actions: true },
];

/** Opened offers first, cheapest first (compared with VAT); the rest keep their order. */
export function ordered(rows: readonly RequestApproach[]): RequestApproach[] {
  const price = (row: RequestApproach) => comparable(row.answer) ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => price(a) - price(b));
}

function FileButton({ path, supplier }: { path: string; supplier: string }) {
  const [error, setError] = useState('');
  return (
    <>
      <Button
        variant="quiet"
        aria-label={`פתיחת קובץ ההצעה של ${supplier}`}
        onClick={() => {
          signedFileUrl(path).then(
            (url) => window.open(url, '_blank', 'noopener'),
            (cause: unknown) => {
              setError(errorText(cause));
            },
          );
        }}
      >
        פתיחה
      </Button>
      <StatusMessage>{error}</StatusMessage>
    </>
  );
}

function rowsOf(list: RequestApproach[]) {
  return ordered(list).map((row) => ({
    id: row.id,
    cells: {
      supplier: row.supplier_name,
      channel: CHANNEL_LABELS[row.channel],
      sent: shortDay(row.approached_on),
      due: row.respond_by ? shortDay(row.respond_by) : 'בלי מועד',
      answer: answerText(row.answer),
      file: row.answer?.file_path ? (
        <FileButton path={row.answer.file_path} supplier={row.supplier_name} />
      ) : null,
    },
  }));
}

function Notes({ list }: { list: RequestApproach[] }) {
  const sealed = list.find((row) => row.sealed && row.answer?.answer === 'offer');
  const opened = list.some((row) => comparable(row.answer) !== null);
  return (
    <>
      {sealed?.respond_by && (
        <Notice tone="info" title={`ההצעות ייפתחו ב-${opensOn(sealed.respond_by)} ב-00:00.`} />
      )}
      {opened && (
        <p>{`הסדר לפי הסכום כולל מע״מ (${String(VAT_RATE * 100)}%), לצורך השוואה בלבד.`}</p>
      )}
    </>
  );
}

type Loaded = { list: RequestApproach[]; error: string } | null;

export function RequestApproaches({ requestId }: { requestId: string }) {
  const [loaded, setLoaded] = useState<Loaded>(null);
  useEffect(() => {
    let live = true;
    loadRequestApproaches(requestId).then(
      (list) => {
        if (live) setLoaded({ list, error: '' });
      },
      (cause: unknown) => {
        if (live) setLoaded({ list: [], error: errorText(cause) });
      },
    );
    return () => {
      live = false;
    };
  }, [requestId]);
  if (!loaded) return <StatusMessage>טוען פניות…</StatusMessage>;
  if (loaded.error) return <Notice tone="error" title={loaded.error} />;
  if (!loaded.list.length)
    return (
      <EmptyState title="עוד לא נרשמו פניות">
        <p>פנייה נרשמת בשלב 3 של הבקשה, בכפתור &quot;רישום פנייה לספקים&quot;.</p>
      </EmptyState>
    );
  return (
    <>
      <Notes list={loaded.list} />
      <DataTable caption="פניות ותשובות" columns={COLUMNS} rows={rowsOf(loaded.list)} />
    </>
  );
}
