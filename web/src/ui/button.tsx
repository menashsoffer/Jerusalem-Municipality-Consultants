import type { ComponentProps, MouseEvent } from 'react';
import { runCommand } from '../lib/dialogs.ts';
import styles from './control.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
interface Props extends ComponentProps<'button'> {
  command?: { target: string; action: 'show-modal' | 'close' };
  /** ui-building-blocks-spec-he.md 4.1: danger only inside a confirm dialog. */
  variant?: ButtonVariant;
  /** While saving: `pendingLabel` replaces the label over a flowing logo stripe; another press does
   * nothing (4.4). */
  pending?: boolean;
  pendingLabel?: string;
}
const CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.button,
  secondary: styles.secondary,
  quiet: styles.quiet,
  danger: styles.danger,
};
// aria-disabled keeps a saving button focusable; data-pending draws the flowing stripe.
const PENDING = { 'aria-disabled': true, 'data-pending': '' } as const;
/** Retains native button semantics, including keyboard activation and dialog commands. */
export function Button({
  command,
  onClick,
  type = 'button',
  className = '',
  variant = 'primary',
  pending = false,
  pendingLabel = 'שומר…',
  children,
  ...props
}: Props) {
  const attributes = command ? { commandfor: command.target, command: command.action } : {};
  function activate(event: MouseEvent<HTMLButtonElement>): void {
    // aria-disabled keeps the button focusable; this keeps it from sending twice.
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!event.defaultPrevented && !('commandForElement' in HTMLButtonElement.prototype)) {
      runCommand(event.currentTarget, event.currentTarget.ownerDocument);
    }
  }
  return (
    <button
      {...props}
      {...attributes}
      {...(pending ? PENDING : {})}
      type={type}
      onClick={activate}
      className={`${CLASS[variant] ?? ''} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
