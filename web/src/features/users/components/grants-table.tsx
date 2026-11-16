import { DataTable } from '../../../ui/data-table.tsx';
import type { GrantRow, Profile, Unit } from '../api/users.ts';
import { ROLE_LABELS } from '../model/permissions.ts';
import styles from './users.module.css';
import { RevokeGrant } from './revoke-grant.tsx';
interface Props {
  grants: GrantRow[];
  profiles: Profile[];
  units: Unit[];
}
export function GrantsTable({ grants, profiles, units }: Props) {
  const names = new Map(profiles.map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]));
  const unitNames = new Map(units.map((u) => [u.id, u.name]));
  return (
    <div className={styles.grants}>
      <DataTable
        caption="תפקידים פעילים"
        columns={[
          { id: 'name', label: 'משתמש' },
          { id: 'role', label: 'תפקיד' },
          { id: 'unit', label: 'יחידה' },
          { id: 'action', label: 'פעולה' },
        ]}
        rows={grants.map((grant) => ({
          id: grant.id,
          cells: {
            name: names.get(grant.user_id) ?? 'משתמש לא זמין',
            role: ROLE_LABELS[grant.role],
            unit: grant.unit_id ? (unitNames.get(grant.unit_id) ?? 'יחידה לא זמינה') : 'כלל המערכת',
            action: (
              <RevokeGrant
                id={grant.id}
                name={`${names.get(grant.user_id) ?? 'משתמש'} · ${ROLE_LABELS[grant.role]}`}
              />
            ),
          },
        }))}
      />
    </div>
  );
}
