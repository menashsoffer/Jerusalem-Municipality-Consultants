import { DataTable } from '../../../ui/data-table.tsx';
import type { LoadControl } from '../api/control.ts';
import { jobStatus, registryStatus, when } from '../model/labels.ts';

export function RegistryTable({ registries }: Pick<LoadControl, 'registries'>) {
  return (
    <DataTable
      caption="מאגרים ושיוכים"
      columns={[
        { id: 'name', label: 'מאגר' },
        { id: 'status', label: 'מצב' },
        { id: 'memberships', label: 'שיוכים' },
        { id: 'review', label: 'בבדיקה' },
        { id: 'verified', label: 'מאומתים' },
      ]}
      rows={registries.map((r, index) => ({
        id: String(index),
        cells: {
          name: r.name,
          status: registryStatus(r.status),
          memberships: r.memberships,
          review: r.needs_review,
          verified: r.verified,
        },
      }))}
    />
  );
}

export function JobTable({ jobs }: Pick<LoadControl, 'jobs'>) {
  return (
    <DataTable
      caption="הרצות אחרונות"
      columns={[
        { id: 'job', label: 'משימה' },
        { id: 'status', label: 'מצב' },
        { id: 'started', label: 'התחילה' },
        { id: 'finished', label: 'הסתיימה' },
      ]}
      rows={jobs.map((job, index) => ({
        id: String(index),
        cells: {
          job: <bdi>{job.job}</bdi>,
          status: jobStatus(job.status),
          started: when(job.started_at),
          finished: when(job.finished_at),
        },
      }))}
    />
  );
}

export function BatchTable({ batches }: Pick<LoadControl, 'batches'>) {
  return (
    <DataTable
      caption="טעינות קבצים"
      columns={[
        { id: 'script', label: 'סקריפט' },
        { id: 'rows', label: 'שורות' },
        { id: 'pending', label: 'ממתינות' },
        { id: 'duplicates', label: 'כפילויות' },
        { id: 'created', label: 'נטען' },
      ]}
      rows={batches.map((batch, index) => ({
        id: String(index),
        cells: {
          script: <bdi>{batch.script_name}</bdi>,
          rows: batch.row_count,
          pending: batch.pending,
          duplicates: batch.duplicates,
          created: when(batch.created_at),
        },
      }))}
    />
  );
}
