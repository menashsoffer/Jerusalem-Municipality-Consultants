import { errorCode, type ErrorReport, type TelemetryEvent } from './vitals-model.ts';
let report: (event: TelemetryEvent) => void = () => undefined;
const objects = new WeakSet<object>();
const primitives = new Set<string>();
export function setTelemetryReporter(send: (event: TelemetryEvent) => void): void {
  report = send;
}
export function reportBoundaryError(error: unknown, boundary: ErrorReport['boundary']): void {
  if (typeof error === 'object' && error !== null) {
    if (objects.has(error)) return;
    objects.add(error);
  } else {
    if (primitives.has(boundary)) return;
    primitives.add(boundary);
  }
  try {
    report({ name: 'error', error_code: errorCode(error), boundary });
  } catch {
    /* Monitoring never breaks recovery. */
  }
}
