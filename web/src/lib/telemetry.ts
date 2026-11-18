import { errorCode, screenOf, type ErrorReport, type TelemetryEvent } from './vitals-model.ts';
import type { FailureKind } from './errors/failure.ts';
let report: (event: TelemetryEvent) => void = () => undefined;
const objects = new WeakSet<object>();
const primitives = new Set<string>();
export function setTelemetryReporter(send: (event: TelemetryEvent) => void): void {
  report = send;
}
/** The screen the person is on; the hash router keeps it in location.hash. */
function currentScreen(): ErrorReport['screen'] {
  try {
    const where = (globalThis as { location?: { hash?: string } }).location;
    return screenOf(where?.hash ?? '');
  } catch {
    return 'other';
  }
}

/** Counts an error once per error object: its kind and screen, never its text. */
export function reportBoundaryError(
  error: unknown,
  boundary: ErrorReport['boundary'],
  kind?: FailureKind,
): void {
  if (typeof error === 'object' && error !== null) {
    if (objects.has(error)) return;
    objects.add(error);
  } else {
    if (primitives.has(boundary)) return;
    primitives.add(boundary);
  }
  try {
    const event: ErrorReport = { name: 'error', error_code: errorCode(error), boundary };
    if (kind) Object.assign(event, { kind, screen: currentScreen() });
    report(event);
  } catch {
    /* Monitoring never breaks recovery. */
  }
}
