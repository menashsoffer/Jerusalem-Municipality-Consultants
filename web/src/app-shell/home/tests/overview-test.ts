import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ADMIN_SCREENS } from '../../screens.ts';
import { dateLabel } from '../../../lib/dates.ts';
import { waitingItems, type HomeOverview } from '../model/overview.ts';

const OVERVIEW: HomeOverview = {
  active_suppliers: 1276,
  registries: 49,
  memberships: 2798,
  memberships_verified: 0,
  suppliers_identified: 473,
  my_open_requests: 0,
  lapsed: [{ registry_id: 'r1', name: 'פיתוח המשאב האנושי', count: 66, ended_on: '2026-11-07' }],
  kind_suggestions_pending: 297,
  registries_without_unit: 23,
};

describe('what waits on the home screen', () => {
  it('lists lapsed registrations first, then approvals, then gaps', () => {
    const items = waitingItems(OVERVIEW, ADMIN_SCREENS, { identifiers_pending: 377 });
    assert.deepEqual(
      items.map((i) => [i.tone, i.title]),
      [
        ['danger', '66 ספקים במאגר "פיתוח המשאב האנושי"'],
        ['warning', 'מועמדי מזהה ספק: 377 מועמדים ממתינים'],
        ['warning', '297 הצעות לסוג ישות'],
        ['info', '23 מאגרים בלי יחידה אחראית'],
      ],
    );
    assert.match(items[0]?.detail ?? '', /07\.11\.2026/);
    assert.deepEqual(items[0]?.linkState, { registry: 'r1', validity: 'expired' });
  });

  it('leaves out screens with nothing waiting and works without the overview', () => {
    const counts = { identifiers_pending: 1, categories_pending: 0 };
    const items = waitingItems(null, ADMIN_SCREENS, counts);
    assert.deepEqual(
      items.map((i) => i.title),
      ['מועמדי מזהה ספק: מועמד ממתין אחד'],
    );
    const quiet = { ...OVERVIEW, lapsed: [], kind_suggestions_pending: 0 };
    assert.deepEqual(waitingItems({ ...quiet, registries_without_unit: 0 }, [], {}), []);
  });

  it('shows dates the Israeli way', () => {
    assert.equal(dateLabel('2026-12-24'), '24.12.2026');
  });
});
