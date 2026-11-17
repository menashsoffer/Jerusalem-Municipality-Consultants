import type { ComponentProps, MouseEvent } from 'react';
import { runCommand } from '../lib/dialogs.ts';
import styles from './control.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
interface Props extends ComponentProps<'button'> {
  command?: { target: string; action: 'show-modal' | 'close' };
  /** ui-building-blocks-spec-he.md 4.1: danger only inside a confirm dialog. */
  variant?: ButtonVariant;
  /** While saving: the label reads `pendingLabel` and another press does nothing (4.4). */
  pending?: boolean;
  pendingLabel?: string;
}
const CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.button,
  secondary: styles.secondary,
  quiet: styles.quiet,
  danger: styles.danger,
};
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
      type={type}
      onClick={activate}
      aria-disabled={pending || props['aria-disabled']}
      className={`${CLASS[variant] ?? ''} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
