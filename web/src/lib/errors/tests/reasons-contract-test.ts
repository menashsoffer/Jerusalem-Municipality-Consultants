// error-handling-spec-he.md section 6: every reason the server can send has Hebrew text,
// and every Hebrew text belongs to a reason the server still sends.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { REASON_MESSAGES, reasonMessage } from '../reasons.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

async function files(dir: string, ending: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(ending))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes('/tests/'));
}

/** Keys the latest server code raises. Older migrations are replaced, so only keys count. */
async function serverKeys(): Promise<Set<string>> {
  const paths = [
    ...(await files(join(ROOT, 'supabase/migrations'), '.sql')),
    ...(await files(join(ROOT, 'supabase/functions'), '.ts')),
  ];
  const keys = new Set<string>();
  for (const path of paths) {
    for (const match of (await readFile(path, 'utf8')).matchAll(/'reason:([a-z_]+)'/g)) {
      keys.add(match[1] ?? '');
    }
  }
  return keys;
}

it('has Hebrew text for every reason the server sends, and no text without a reason', async () => {
  const raised = [...(await serverKeys())].sort();
  assert.deepEqual(raised, Object.keys(REASON_MESSAGES).sort());
});

it('reads only a whole reason message', () => {
  assert.equal(reasonMessage('reason:last_admin'), REASON_MESSAGES.last_admin);
  assert.equal(reasonMessage(' reason:last_admin '), REASON_MESSAGES.last_admin);
  assert.equal(reasonMessage('reason:unknown_key'), null);
  assert.equal(reasonMessage('The last admin cannot be revoked'), null);
});
