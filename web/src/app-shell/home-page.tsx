import { Link } from 'react-router';
/** Landing screen of the admin page. Admin screens add their links here as they arrive. */
export function HomePage() {
  return (
    <>
      <h1 tabIndex={-1}>מסכי הניהול</h1>
      <p>
        <Link to="/identifiers">מועמדי מזהה ספק</Link>
      </p>
      <p>
        <Link to="/route-check">בדיקת מסלול ההתקשרות</Link>
      </p>
      <p>
        <Link to="/users">משתמשים ותפקידים</Link>
      </p>
      <p>
        <Link to="/thresholds">אישור הסף החודשי</Link>
      </p>
      <p>
        <Link to="/auth">כניסה והרשאות</Link>
      </p>
      <p>בחרו את המסך המתאים לפעולה שברצונכם לבצע.</p>
    </>
  );
}
