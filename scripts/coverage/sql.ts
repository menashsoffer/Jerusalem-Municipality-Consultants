// Merges the per-database function call counts that supabase/tests/pglite.ts writes when
// SQL_COVERAGE_DIR is set. A function is covered when any test database called it.

export interface FunctionCalls {
  name: string;
  calls: number;
}

export function parseCalls(text: string): FunctionCalls[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new Error('SQL coverage file is not a list');
  return value.map((row: unknown) => {
    if (typeof row !== 'object' || row === null) throw new Error('Bad SQL coverage row');
    const { name, calls } = row as Record<string, unknown>;
    if (typeof name !== 'string' || typeof calls !== 'number') {
      throw new Error('Bad SQL coverage row');
    }
    return { name, calls };
  });
}

export function mergeCalls(dumps: FunctionCalls[][]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const row of dumps.flat()) merged.set(row.name, (merged.get(row.name) ?? 0) + row.calls);
  return merged;
}

export function uncalled(merged: Map<string, number>): string[] {
  return [...merged]
    .filter(([, calls]) => calls === 0)
    .map(([name]) => name)
    .sort();
}
