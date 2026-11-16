import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <>
      <h1 tabIndex={-1}>הדף לא נמצא</h1>
      <p>
        הכתובת אינה קיימת במסכי הניהול. <Link to="/">חזרה למסכי הניהול</Link>
      </p>
    </>
  );
}
