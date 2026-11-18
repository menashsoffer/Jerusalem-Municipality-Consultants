import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { loadUsers } from './api/users.ts';
import { activeGrants, availableUnits } from './model/permissions.ts';
import { ProfileReview } from './components/profile-review.tsx';
import { GrantForm } from './components/grant-form.tsx';
import { GrantsTable } from './components/grants-table.tsx';
import { ChangeRequests } from './components/change-review.tsx';
export const loader = loadUsers;
function Loading() {
  return (
    <>
      <h1 tabIndex={-1}>משתמשים ותפקידים</h1>
      <Skeleton />
    </>
  );
}
export function UsersPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const pending = data.profiles.filter((p) => p.status === 'pending');
  const active = data.profiles.filter((p) => p.status === 'active');
  const grants = activeGrants(data.grants, data.now);
  const units = availableUnits(data.units, data.who.access);
  const unitNames = new Map(data.units.map((u) => [u.id, u.name]));
  if (navigation.state === 'loading') return <Loading />;
  return (
    <>
      <h1 tabIndex={-1}>משתמשים ותפקידים</h1>
      <h2>בקשות גישה ממתינות</h2>
      {pending.length ? (
        pending.map((profile) => (
          <ProfileReview
            key={profile.user_id}
            profile={profile}
            currentUser={data.who.userId}
            unit={data.units.find((u) => u.id === profile.unit_id)?.name ?? 'יחידה לא זמינה'}
          />
        ))
      ) : (
        <EmptyState title="אין בקשות ממתינות" />
      )}
      {data.changes && (
        <ChangeRequests
          changes={data.changes}
          profiles={data.profiles}
          grants={data.grants}
          units={unitNames}
        />
      )}
      <h2>הענקת תפקיד</h2>
      {active.length ? (
        <GrantForm profiles={active} scope={{ admin: data.who.access.admin, units }} />
      ) : (
        <EmptyState title="אין משתמשים פעילים" />
      )}
      <h2>הרשאות פעילות</h2>
      {grants.length ? (
        <GrantsTable grants={grants} profiles={data.profiles} units={data.units} />
      ) : (
        <EmptyState title="אין תפקידים פעילים להצגה" />
      )}
    </>
  );
}
