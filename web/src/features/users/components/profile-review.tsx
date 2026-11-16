import type { Profile } from '../api/users.ts';
import { ProfileReviewForm } from './profile-review-form.tsx';
import styles from './users.module.css';
interface Props {
  profile: Profile;
  currentUser: string;
  unit: string;
}
export function ProfileReview({ profile, currentUser, unit }: Props) {
  const name = `${profile.first_name} ${profile.last_name}`;
  return (
    <article className={styles.card}>
      <h3>{name}</h3>
      <p>
        <bdi>{profile.email}</bdi> · {profile.job_title} · {unit}
      </p>
      <p>{profile.purpose}</p>
      {profile.user_id === currentUser ? (
        <p>אין לאשר את הבקשה של עצמך.</p>
      ) : (
        <ProfileReviewForm id={profile.user_id} name={name} />
      )}
    </article>
  );
}
