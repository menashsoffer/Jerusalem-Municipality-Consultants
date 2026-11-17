import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecision } from '../model/decision.ts';
function form(decision: string, note = '', category = '') {
  const data = new FormData();
  data.set('decision', decision);
  data.set('note', note);
  data.set('category_id', category);
  return data;
}
describe('category decision input', () => {
  it('requires a rejection reason and a link destination', () => {
    assert.deepEqual(parseDecision(form('rejected', ' ')), { error: 'יש לציין נימוק לדחייה.' });
    assert.deepEqual(parseDecision(form('linked')), { error: 'יש לבחור קטגוריה קיימת לקישור.' });
  });
  it('sends no category target when approving or rejecting', () => {
    assert.deepEqual(parseDecision(form('approved', ' נדרש ', 'irrelevant')), {
      decision: 'approved',
      note: 'נדרש',
      category_id: null,
    });
    assert.deepEqual(parseDecision(form('linked', '', 'chosen')), {
      decision: 'linked',
      note: '',
      category_id: 'chosen',
    });
  });
});
