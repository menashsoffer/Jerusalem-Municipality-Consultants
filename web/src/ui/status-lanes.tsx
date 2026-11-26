import { Icon, type IconName } from './icon.tsx';
import { IconButton } from './icon-button.tsx';
import styles from './status-lanes.module.css';

/** One status, one colour (DESIGN.md 2.3): peach urgent, butter waiting, sage to complete. */
export type LaneTone = 'danger' | 'warning' | 'info';

export interface LaneItem {
  id: string;
  tone: LaneTone;
  title: string;
  detail?: string | undefined;
  /** What the open button does, said to screen readers and shown as its tooltip. */
  action: string;
  open: () => void;
}

export type LaneNames = Readonly<Record<LaneTone, string>>;

/**
 * The lanes keep their place and carry no visible title (Menash, 26.11.2026). Colour may not be
 * the only cue (WCAG 1.4.1, required by IS 5568), so each lane also shows its own shape. The
 * names stay in the headings for screen readers.
 */
const LANES: readonly { tone: LaneTone; icon: IconName }[] = [
  { tone: 'danger', icon: 'warning' },
  { tone: 'warning', icon: 'clock' },
  { tone: 'info', icon: 'pencil' },
];

function Item({ item }: { item: LaneItem }) {
  return (
    <li className={styles.item}>
      <div className={styles.text}>
        <strong>{item.title}</strong>
        {item.detail && <span className={styles.detail}>{item.detail}</span>}
      </div>
      <IconButton
        icon="open"
        variant="secondary"
        label={`${item.action}: ${item.title}`}
        tip={item.action}
        onClick={item.open}
      />
    </li>
  );
}

interface LaneProps {
  id: string;
  name: string;
  icon: IconName;
  tone: LaneTone;
  items: readonly LaneItem[];
}

function Lane({ id, name, icon, tone, items }: LaneProps) {
  return (
    <section className={styles.lane} data-tone={tone} aria-labelledby={id}>
      <h3 id={id} className={styles.head}>
        <Icon name={icon} />
        <span className={styles.hidden}>{name}: </span>
        <span>{items.length.toLocaleString('he-IL')}</span>
      </h3>
      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface Props {
  /** Prefix for the lane heading ids, unique on the page. */
  id: string;
  names: LaneNames;
  items: readonly LaneItem[];
}

/** Three coloured lanes side by side, one under another when narrow. */
export function StatusLanes({ id, names, items }: Props) {
  return (
    <div className={styles.lanes}>
      {LANES.map(({ tone, icon }) => (
        <Lane
          key={tone}
          id={`${id}-${tone}`}
          name={names[tone]}
          icon={icon}
          tone={tone}
          items={items.filter((i) => i.tone === tone)}
        />
      ))}
    </div>
  );
}
