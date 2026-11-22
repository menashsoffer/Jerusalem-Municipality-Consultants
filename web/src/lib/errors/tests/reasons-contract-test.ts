// error-handling-spec-he.md section 6: every reason the server can send has Hebrew text,
// and every Hebrew text belongs to a reason the server still sends.
import assert from 'node:assert/strict';
import { it } from 'node:test';

import { REASON_MESSAGES, reasonMessage } from '../reasons.ts';
import { serverKeys } from './server-keys.ts';

it('has Hebrew text for every reason the server sends, and no text without a reason', async () => {
  // The import screen registers its own texts; features/excel-import/tests checks those.
  const raised = [...(await serverKeys())].filter((key) => !key.startsWith('import_')).sort();
  assert.deepEqual(raised, Object.keys(REASON_MESSAGES).sort());
});

it('reads only a whole reason message', () => {
  assert.equal(reasonMessage('reason:last_admin'), REASON_MESSAGES.last_admin);
  assert.equal(reasonMessage(' reason:last_admin '), REASON_MESSAGES.last_admin);
  assert.equal(reasonMessage('reason:unknown_key'), null);
  assert.equal(reasonMessage('The last admin cannot be revoked'), null);
});
