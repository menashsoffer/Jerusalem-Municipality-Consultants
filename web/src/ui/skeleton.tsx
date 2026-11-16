import styles from './panel.module.css';
interface Props {
  label?: string;
}
export function Skeleton({ label = 'טוען נתונים…' }: Props) {
  return (
    <div className={styles.panel} role="progressbar" aria-label={label} aria-busy="true">
      <p>{label}</p>
      <div className={styles.skeleton} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
