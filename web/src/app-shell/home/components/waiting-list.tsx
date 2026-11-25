import { Link } from 'react-router';
import controls from '../../../ui/control.module.css';
import type { WaitingItem } from '../model/overview.ts';
import styles from '../home.module.css';

/** "מחכה לך": each line says what, why it matters and where to handle it. */
export function WaitingList({ items }: { items: readonly WaitingItem[] }) {
  return (
    <section aria-labelledby="home-waiting" className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 id="home-waiting">מחכה לך</h2>
        <span className={styles.muted}>
          {items.length ? `${items.length.toLocaleString('he-IL')} נושאים פתוחים` : ''}
        </span>
      </div>
      {items.length ? (
        <ul className={styles.waiting}>
          {items.map((item, index) => (
            <li key={item.id} className={styles.item} data-tone={item.tone}>
              <span className={styles.badge}>{item.badge}</span>
              <div className={styles.itemText}>
                <strong>{item.title}</strong>
                <span className={styles.muted}>{item.detail}</span>
              </div>
              <Link
                to={item.to}
                state={item.linkState}
                className={index === 0 ? controls.button : controls.secondary}
              >
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>אין כרגע עבודה שמחכה לך.</p>
      )}
    </section>
  );
}
