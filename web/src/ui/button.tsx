import type { ComponentProps, MouseEvent } from 'react';
import { runCommand } from '../lib/dialogs.ts';
import styles from './control.module.css';

interface Props extends ComponentProps<'button'> {
  command?: { target: string; action: 'show-modal' | 'close' };
  /** DESIGN.md 6.2: one primary action per screen, secondary for the rest. */
  variant?: 'primary' | 'secondary' | 'danger';
}
/** Retains native button semantics, including keyboard activation and dialog commands. */
export function Button({
  command,
  onClick,
  type = 'button',
  className = '',
  variant = 'primary',
  ...props
}: Props) {
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
      className={`${styles[variant === 'primary' ? 'button' : variant] ?? ''} ${className}`}
    />
  );
}
