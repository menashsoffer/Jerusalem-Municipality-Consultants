import { useId, type MouseEvent, type ReactNode } from 'react';
import { onBackdrop } from '../lib/dialogs.ts';
import { Button } from './button.tsx';
import { Icon } from './icon.tsx';
import styles from './panel.module.css';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

const lightDismissIsNative = () =>
  typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/**
 * A modal dialog that closes with the X in its corner, Escape, or a click on the backdrop
 * (closedby="any"; browsers without it get the same behaviour from the click handler).
 */
export function Dialog({ id, title, children, onClose }: Props) {
  const titleId = useId();
  function click(event: MouseEvent<HTMLDialogElement>) {
    const dialog = event.currentTarget;
    if (!lightDismissIsNative() && onBackdrop(dialog, event.nativeEvent)) dialog.close();
  }
  return (
    // The click handler only adds backdrop dismissal; Escape and the X button stay available.
    /* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events,
       jsx-a11y-x/no-noninteractive-element-interactions */
    <dialog
      id={id}
      aria-labelledby={titleId}
      className={styles.dialog}
      closedby="any"
      onClick={click}
      onClose={onClose}
    >
      <div className={styles.dialogHead}>
        <h2 id={titleId}>{title}</h2>
        {/* Native dialogs need an initial focus target when showModal opens them. */}
        {/* eslint-disable jsx-a11y-x/no-autofocus */}
        <Button
          variant="secondary"
          className={styles.close}
          command={{ target: id, action: 'close' }}
          aria-label="סגירה"
          autoFocus
        >
          <Icon name="close" />
        </Button>
        {/* eslint-enable jsx-a11y-x/no-autofocus */}
      </div>
      {children}
    </dialog>
  );
}
