import type { ComponentProps, MouseEvent } from 'react';
import { runCommand } from '../lib/dialogs.ts';
import styles from './control.module.css';

interface Props extends ComponentProps<'button'> {
  command?: { target: string; action: 'show-modal' | 'close' };
}
/** Retains native button semantics, including keyboard activation and dialog commands. */
export function Button({ command, onClick, type = 'button', className = '', ...props }: Props) {
  const attributes = command ? { commandfor: command.target, command: command.action } : {};
  function activate(event: MouseEvent<HTMLButtonElement>): void {
    onClick?.(event);
    if (!event.defaultPrevented && !('commandForElement' in HTMLButtonElement.prototype)) {
      runCommand(event.currentTarget, event.currentTarget.ownerDocument);
    }
  }
  return (
    <button
      {...props}
      {...attributes}
      type={type}
      onClick={activate}
      className={`${styles.button ?? ''} ${className}`}
    />
  );
}
