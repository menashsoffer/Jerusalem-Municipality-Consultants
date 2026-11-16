import { useId, type ReactNode } from 'react';
import { Button } from './button.tsx';
import styles from './panel.module.css';
interface Props {
  id: string;
  title: string;
  children: ReactNode;
}
export function Dialog({ id, title, children }: Props) {
  const titleId = useId();
  return (
    <dialog id={id} aria-labelledby={titleId} className={styles.dialog}>
      <h2 id={titleId}>{title}</h2>
      {children}
      {/* Native dialogs need an initial focus target when showModal opens them. */}
      {/* eslint-disable-next-line jsx-a11y-x/no-autofocus */}
      <Button command={{ target: id, action: 'close' }} autoFocus>
        סגירה
      </Button>
    </dialog>
  );
}
