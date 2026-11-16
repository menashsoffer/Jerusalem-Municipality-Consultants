/* Keeps aria-invalid in step with what the user sees. The CSS shows a field's error only after
   the user has edited and left it, or tried to submit (:user-invalid); screen readers get the
   same signal at the same moment, never before the user has had a chance to type. */

type Control = HTMLInputElement | HTMLSelectElement;

function isControl(node: EventTarget | null): node is Control {
  const tag = (node as Element | null)?.tagName;
  return tag === 'INPUT' || tag === 'SELECT';
}

function mark(control: Control, invalid: boolean): void {
  control.setAttribute('aria-invalid', String(invalid));
}

function controls(form: HTMLFormElement): Control[] {
  return [...form.querySelectorAll<Control>('input, select')];
}

/** Starts every field as valid and updates it on leave, on fix and on a submit attempt. */
export function syncInvalidState(form: HTMLFormElement): void {
  const edited = new WeakSet<Control>();
  for (const control of controls(form)) mark(control, false);
  form.addEventListener('input', (event) => {
    if (!isControl(event.target)) return;
    edited.add(event.target);
    if (event.target.validity.valid) mark(event.target, false);
  });
  form.addEventListener('focusout', (event) => {
    if (isControl(event.target) && edited.has(event.target))
      mark(event.target, !event.target.validity.valid);
  });
  // "invalid" does not bubble, so it is caught on the way down.
  form.addEventListener(
    'invalid',
    (event) => {
      if (isControl(event.target)) mark(event.target, true);
    },
    true,
  );
  form.addEventListener('reset', () => {
    for (const control of controls(form)) mark(control, false);
  });
}

/** The identifier type and number go together: both filled or both empty. */
export function identifierPairMessage(scheme: string, identifier: string): string {
  return !!scheme.trim() === !!identifier.trim()
    ? ''
    : 'יש למלא גם סוג מזהה וגם מספר, או להשאיר את שניהם ריקים.';
}
