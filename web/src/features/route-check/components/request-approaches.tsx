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
  extendRange,
  opensOn,
  recordable,
  shortDay,
  VAT_RATE,
} from '../model/approaches.ts';
import { ExtendDeadline, RecordAnswer } from './approach-staff.tsx';

export const REQUEST_APPROACHES = 'request-approaches';

const COLUMNS = [
  { id: 'supplier', label: 'ספק' },
  { id: 'channel', label: 'ערוץ' },
  { id: 'sent', label: 'נשלחה' },
  { id: 'due', label: 'מועד' },
  { id: 'answer', label: 'תשובה' },
  { id: 'file', label: 'פעולות', actions: true },
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

interface Rows {
  list: RequestApproach[];
  today: string;
  record: (row: RequestApproach) => void;
}

function Action({ row, today, record }: Omit<Rows, 'list'> & { row: RequestApproach }) {
  if (row.answer?.file_path) {
    return <FileButton path={row.answer.file_path} supplier={row.supplier_name} />;
  }
  if (!recordable(row, today)) return null;
  return (
    <Button
      variant="quiet"
      aria-label={`רישום תשובה של ${row.supplier_name}`}
      onClick={() => {
        record(row);
      }}
    >
      רישום תשובה
    </Button>
  );
}

function rowsOf({ list, ...actions }: Rows) {
  return ordered(list).map((row) => ({
    id: row.id,
    cells: {
      supplier: row.supplier_name,
      channel: CHANNEL_LABELS[row.channel],
      sent: shortDay(row.approached_on),
      due: row.respond_by ? shortDay(row.respond_by) : 'בלי מועד',
      answer: answerText(row.answer),
      file: <Action row={row} {...actions} />,
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

/** The request's approaches, fetched again whenever `round` changes. */
function useApproaches(requestId: string, round: number): Loaded {
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
  }, [requestId, round]);
  return loaded;
}

type Open = { kind: 'record'; row: RequestApproach } | { kind: 'extend' } | null;

interface Props {
  requestId: string;
  today: string;
}

function StaffForm({
  open,
  list,
  ...props
}: Props & Done & { open: Open; list: RequestApproach[] }) {
  const range = extendRange(list, props.today);
  if (open?.kind === 'record') return <RecordAnswer key={open.row.id} row={open.row} {...props} />;
  if (open?.kind === 'extend' && range) return <ExtendDeadline range={range} {...props} />;
  return null;
}

interface Done {
  done: (message: string) => void;
  cancel: () => void;
}

function ExtendButton({ open }: { open: () => void }) {
  return (
    <Button variant="secondary" onClick={open}>
      הארכת המועד
    </Button>
  );
}

function ApproachList({
  list,
  reload,
  ...props
}: Props & { list: RequestApproach[]; reload: () => void }) {
  const [open, setOpen] = useState<Open>(null);
  const [message, setMessage] = useState('');
  const choose = (next: Open) => {
    setMessage('');
    setOpen(next);
  };
  const done = (text: string) => {
    setOpen(null);
    setMessage(text);
    reload();
  };
  const record = (row: RequestApproach) => {
    choose({ kind: 'record', row });
  };
  return (
    <>
      <Notes list={list} />
      <StatusMessage>{message}</StatusMessage>
      {!open && extendRange(list, props.today) && (
        <ExtendButton
          open={() => {
            choose({ kind: 'extend' });
          }}
        />
      )}
      <DataTable
        caption="פניות ותשובות"
        columns={COLUMNS}
        rows={rowsOf({ list, today: props.today, record })}
      />
      <StaffForm
        open={open}
        list={list}
        {...props}
        done={done}
        cancel={() => {
          choose(null);
        }}
      />
    </>
  );
}

export function RequestApproaches(props: Props) {
  const [round, setRound] = useState(0);
  const loaded = useApproaches(props.requestId, round);
  if (!loaded) return <StatusMessage>טוען פניות…</StatusMessage>;
  if (loaded.error) return <Notice tone="error" title={loaded.error} />;
  if (!loaded.list.length)
    return (
      <EmptyState title="עוד לא נרשמו פניות">
        <p>פנייה נרשמת בשלב 3 של הבקשה, בכפתור &quot;רישום פנייה לספקים&quot;.</p>
      </EmptyState>
    );
  return (
    <ApproachList
      list={loaded.list}
      {...props}
      reload={() => {
        setRound((n) => n + 1);
      }}
    />
  );
}
