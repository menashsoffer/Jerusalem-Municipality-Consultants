import { useRef, useState } from 'react';
import { Icon } from '../../../ui/icon.tsx';
import styles from './supplier.module.css';

/**
 * Copies one contact value. The bubble is the live region, outside the button, and stays
 * visible for both outcomes; the button is never disabled, so a retry is always possible.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  async function copy() {
    clearTimeout(timer.current);
    setMessage('');
    let text = 'הועתק';
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      text = 'ההעתקה נכשלה';
    }
    requestAnimationFrame(() => {
      setMessage(text);
    });
    timer.current = setTimeout(() => {
      setMessage('');
    }, 2000);
  }
  return (
    <span className={styles.copy}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`העתקת ${label}`}
        data-copied={message === 'הועתק' ? '' : undefined}
        onClick={() => {
          void copy();
        }}
      >
        <Icon name={message === 'הועתק' ? 'check' : 'copy'} />
      </button>
      <span role="status" className={styles.tip}>
        {message}
      </span>
    </span>
  );
}
