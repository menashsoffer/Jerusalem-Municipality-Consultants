import { useNavigate } from 'react-router';
import { IconButton } from '../../../ui/icon-button.tsx';
import type { Tone, WaitingItem } from '../model/overview.ts';
import styles from '../home.module.css';

/**
 * The three lanes keep their place and say what they are by colour alone (Menash, 26.11.2026):
 * peach urgent, butter waiting for your approval, sage to complete. The names stay for screen
 * readers, hidden from the eye.
 */
const LANES: readonly { tone: Tone; name: string }[] = [
  { tone: 'danger', name: 'דחוף' },
  { tone: 'warning', name: 'מחכה לאישור שלך' },
  { tone: 'info', name: 'להשלים' },
];

function Item({ item }: { item: WaitingItem }) {
  const navigate = useNavigate();
  return (
    <li className={styles.item}>
      <div className={styles.itemText}>
        <strong>{item.title}</strong>
        <span className={styles.muted}>{item.detail}</span>
      </div>
      <IconButton
        icon="open"
        variant="secondary"
        label={`${item.action}: ${item.title}`}
        tip={item.action}
        onClick={() => {
          void navigate(item.to, { state: item.linkState });
        }}
      />
    </li>
  );
}

function Lane({ tone, name, items }: { tone: Tone; name: string; items: readonly WaitingItem[] }) {
  const id = `home-lane-${tone}`;
  return (
    <section className={styles.lane} data-tone={tone} aria-labelledby={id}>
      <h3 id={id} className={styles.laneHead}>
        <span className={styles.hidden}>{name}: </span>
        <span className={styles.laneCount}>{items.length.toLocaleString('he-IL')}</span>
      </h3>
      {items.length > 0 && (
        <ul className={styles.laneList}>
          {items.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** "מחכה לך": everything that waits for this user, in three coloured lanes. */
export function WaitingList({ items }: { items: readonly WaitingItem[] }) {
  return (
    <section aria-labelledby="home-waiting" className={[styles.panel, styles.wait].join(' ')}>
      <div className={styles.panelHead}>
        <h2 id="home-waiting">מחכה לך</h2>
        <span className={styles.muted}>
          {items.length ? `${items.length.toLocaleString('he-IL')} נושאים פתוחים` : ''}
        </span>
      </div>
      {items.length ? (
        <div className={styles.lanes}>
          {LANES.map((lane) => (
            <Lane key={lane.tone} {...lane} items={items.filter((i) => i.tone === lane.tone)} />
          ))}
        </div>
      ) : (
        <p className={styles.muted}>הכול טופל. יום שקט לפניך.</p>
      )}
    </section>
  );
}
