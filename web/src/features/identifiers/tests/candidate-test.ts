import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nameHint, candidateSchema, evidenceHint } from '../model/candidate.ts';
describe('identifier evidence', () => {
  it('never treats an exact textual match as proof', () => {
    assert.match(nameHint('יועצי העיר בע״מ', 'יועצי העיר בע"מ'), /רמז בלבד/);
    assert.match(nameHint('ספק א', 'ספק ב'), /אינו הוכחה/);
    assert.match(nameHint('ספק א', null), /ידנית/);
  });
  it('refuses unsupported sources and malformed identifiers', () => {
    const row = {
      id: 'c',
      supplier_id: 's',
      scheme: 'company',
      value: '512345678',
      source: 'companies_registrar',
      registrar_name: null,
      registrar_status: null,
      searched_name: 'א',
      found_at: '2026-11-16',
    };
    assert.equal(candidateSchema.safeParse(row).success, true);
    assert.equal(candidateSchema.safeParse({ ...row, value: '<script>' }).success, false);
    assert.equal(candidateSchema.safeParse({ ...row, source: 'untrusted' }).success, false);
  });
  it('asks for a registrar check on a number taken from a pool file', () => {
    const row = candidateSchema.parse({
      id: 'c',
      supplier_id: 's',
      scheme: 'personal_id',
      value: '012345678',
      source: 'pool_file',
      registrar_name: null,
      registrar_status: null,
      searched_name: 'ספק א',
      found_at: '2026-11-17',
    });
    assert.match(evidenceHint(row, 'ספק א'), /לפי השם בלבד/);
    assert.match(evidenceHint({ ...row, source: 'guidestar' }, 'ספק א'), /ידנית/);
  });
});
