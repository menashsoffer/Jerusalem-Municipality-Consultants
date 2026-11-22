// supplier-approaches-spec-he.md 7.4: every approach refusal the database sends has Hebrew
// text, registered for the shared error display once a screen imports it.
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { APPROACH_REASONS } from '../approach-reasons.ts';
import { reasonMessage } from '../reasons.ts';
import { serverKeys } from './server-keys.ts';

it('has text for every approach reason the database sends, and none extra', async () => {
  const raised = [...(await serverKeys())].filter((key) => key.startsWith('approach_')).sort();
  assert.deepEqual(raised, Object.keys(APPROACH_REASONS).sort());
  assert.equal(reasonMessage('reason:approach_closed'), APPROACH_REASONS.approach_closed);
});
