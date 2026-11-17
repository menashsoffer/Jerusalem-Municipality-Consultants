import { useState } from 'react';
import { Icon } from '../../../ui/icon.tsx';
import type { VerificationMark as Mark } from '../model/view.ts';
import styles from './supplier.module.css';

/**
 * A clock while the supplier waits for verification, a check badge once verified. The label is
 * the button's name for screen readers and a bubble for sighted users on hover, keyboard focus
 * or tap. The pointer can move onto the bubble, and Escape hides it (WCAG 1.4.13).
 */
export function VerificationMark({ mark }: { mark: Mark }) {
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
  };
  return (
    <span className={styles.mark} onPointerEnter={show} onPointerLeave={hide}>
      <button
        type="button"
        className={[styles.markButton, mark.verified ? styles.verified : styles.pending].join(' ')}
        aria-label={mark.label}
        onFocus={show}
        onBlur={hide}
        // A tap also focuses and hovers, so it only shows; tapping elsewhere blurs and hides.
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide();
        }}
      >
        <Icon name={mark.verified ? 'verified' : 'clock'} />
      </button>
      <span className={styles.markTip} aria-hidden="true" hidden={!open}>
        {mark.label}
      </span>
    </span>
  );
}
