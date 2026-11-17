import { Link } from 'react-router';

import styles from './home-page.module.css';

interface Screen {
  to: string;
  title: string;
  description: string;
}

/** Admin screens, most used first. A new admin screen adds its card here. */
const SCREENS: readonly Screen[] = [
  { to: '/supplier/new', title: 'הוספת ספק למאגר', description: 'רישום ספק חדש באחד המאגרים' },
  { to: '/categories', title: 'בקשות קטגוריה', description: 'אישור תחומים ששויכו לספקים' },
  { to: '/identifiers', title: 'מועמדי מזהה ספק', description: 'אישור ח.פ. שנמצא לספק' },
  { to: '/thresholds', title: 'אישור הסף החודשי', description: 'ספי ההתקשרות לפי מדד החודש' },
  { to: '/load-control', title: 'בקרת טעינה', description: 'מה נטען מהמאגרים ומה חסר' },
  { to: '/users', title: 'משתמשים ותפקידים', description: 'מי נכנס לאתר ובאיזו הרשאה' },
  { to: '/route-check', title: 'בדיקת מסלול ההתקשרות', description: 'חישוב מסלול בלי בקשה' },
  { to: '/auth', title: 'כניסה והרשאות', description: 'החשבון שלך והתנתקות' },
];

/** Landing screen of the admin section: one card per admin screen. */
export function HomePage() {
  return (
    <>
      <h1 tabIndex={-1}>מסכי הניהול</h1>
      <p className={styles.lead}>בחרו את המסך המתאים לפעולה שברצונכם לבצע.</p>
      <ul className={styles.grid}>
        {SCREENS.map((screen) => (
          <li key={screen.to} className={styles.card}>
            <Link to={screen.to} className={styles.link}>
              {screen.title}
            </Link>
            <span className={styles.description}>{screen.description}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
