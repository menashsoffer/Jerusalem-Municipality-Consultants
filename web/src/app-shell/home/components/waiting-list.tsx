import { useNavigate } from 'react-router';
import { StatusLanes, type LaneItem } from '../../../ui/status-lanes.tsx';
import type { WaitingItem } from '../model/overview.ts';
import styles from '../home.module.css';

const NAMES = { danger: 'דחוף', warning: 'מחכה לאישור שלך', info: 'להשלים' } as const;

/** "מחכה לך": everything that waits for this user, in three coloured lanes. */
export function WaitingList({ items }: { items: readonly WaitingItem[] }) {
  const navigate = useNavigate();
  const lanes = items.map((item): LaneItem => ({
    id: item.id,
    tone: item.tone,
    title: item.title,
    detail: item.detail,
    action: item.action,
    open: () => {
      void navigate(item.to, { state: item.linkState });
    },
  }));
  return (
    <section aria-labelledby="home-waiting" className={[styles.panel, styles.wait].join(' ')}>
      <div className={styles.panelHead}>
        <h2 id="home-waiting">מחכה לך</h2>
        <span className={styles.muted}>
          {items.length ? `${items.length.toLocaleString('he-IL')} נושאים פתוחים` : ''}
        </span>
      </div>
      {items.length ? (
        <StatusLanes id="home-lane" names={NAMES} items={lanes} />
      ) : (
        <p className={styles.muted}>הכול טופל. יום שקט לפניך.</p>
      )}
    </section>
  );
}
