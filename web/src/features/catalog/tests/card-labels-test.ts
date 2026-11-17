import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contactSummary,
  venueFacts,
  inactiveLine,
  membershipState,
  supplierBadges,
} from '../model/card-labels.ts';

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

it('says which contact kinds exist and marks memberships under review or closed', () => {
  assert.equal(contactSummary(['email', 'phone']), 'יש במאגר: טלפון ודוא״ל');
  assert.equal(contactSummary(['address']), 'אין טלפון או דוא״ל במאגר');
  assert.deepEqual(membershipState({ reviewStatus: 'needs_review', registryClosed: true }), [
    'מאגר סגור',
    'בבדיקה',
  ]);
  assert.deepEqual(membershipState({ reviewStatus: 'verified', registryClosed: false }), []);
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
