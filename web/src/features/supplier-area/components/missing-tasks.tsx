import { StatusLanes, type LaneItem } from '../../../ui/status-lanes.tsx';
import type { Task } from '../model/missing.ts';
import styles from './area.module.css';

const NAMES = { danger: 'דחוף', warning: 'מחכה לתשובה', info: 'להשלים' } as const;

// The site uses a hash router, so an in-page "#id" link would change the route. Focusing the
// section's heading (tabIndex -1) scrolls it into view at once and moves the keyboard there.
function goTo(target: string) {
  document.getElementById(target)?.focus();
}

/** "מה חסר לי" (spec 6.3) in the three status lanes of the home screen; only when needed. */
export function MissingTasks({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  const items = tasks.map((task): LaneItem => ({
    id: task.key,
    tone: task.tone,
    title: task.text,
    action: 'מעבר',
    open: () => {
      goTo(task.target);
    },
  }));
  return (
    <section className={styles.panel} aria-labelledby="missing-title">
      <h2 id="missing-title">מה חסר לי</h2>
      <StatusLanes id="missing-lane" names={NAMES} items={items} />
    </section>
  );
}
