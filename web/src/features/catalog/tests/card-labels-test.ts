import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contactSummary,
  venueFacts,
  inactiveLine,
  supplierFields,
  supplierBadges,
} from '../model/card-labels.ts';
import type { Membership } from '../../../catalog-model.ts';

it('answers the identifier and activity questions with separate badges', () => {
  assert.deepEqual(
    supplierBadges({ identifier: null, inactive: null }).map((b) => b.text),
    ['אין ח.פ. מאושר'],
  );
  const inactive = { reason: 'מונתה לשופטת', source: 'פרסום', changedOn: '2026-09-01' };
  assert.deepEqual(
    supplierBadges({ identifier: 'pending', inactive }).map((b) => [b.tone, b.text]),
    [
      ['warning', 'ח.פ. ממתין לאישור'],
      ['danger', 'לא פעיל'],
    ],
  );
  assert.equal(inactiveLine(inactive), 'סיבה: מונתה לשופטת · מקור: פרסום · מתאריך 2026-09-01');
});

it('says which contact kinds exist', () => {
  assert.equal(contactSummary(['email', 'phone']), 'יש במאגר: טלפון ודוא״ל');
  assert.equal(contactSummary(['address']), 'אין טלפון או דוא״ל במאגר');
});

describe('supplier fields on the card', () => {
  const listing = (field: string, validUntil: string | null) =>
    ({ registry: 'מאגר יועצים', field, validFrom: null, validUntil }) as Membership;
  it('lists each current field once, using the registry when a listing has no field', () => {
    const rows = [listing('ניהול פרויקטים', null), listing('ניהול פרויקטים', '2027-01-01')];
    rows.push(listing('', null), listing('תכנון', '2020-01-01'));
    assert.deepEqual(supplierFields(rows, '2026-11-17'), ['ניהול פרויקטים', 'מאגר יועצים']);
  });
  it('falls back to expired listings when nothing current is left', () => {
    assert.deepEqual(supplierFields([listing('תכנון', '2020-01-01')], '2026-11-17'), ['תכנון']);
  });
});

describe('venue facts', () => {
  it('labels each published detail in words and skips empty ones', () => {
    const venue = {
      capacity: 360,
      capacity_text: '360 מקומות ישיבה',
      hall_size: '35X25',
      stage_size: null,
      screen: 'אין',
      sound: '',
      lighting: null,
      survey_year: 2018,
    };
    assert.deepEqual(
      venueFacts(venue).map((fact) => fact.text),
      ['קיבולת: 360 מקומות ישיבה', 'גודל אולם: 35X25', 'מסך: אין', 'לפי מאגר 2018'],
    );
    assert.deepEqual(venueFacts(null), []);
  });
});
