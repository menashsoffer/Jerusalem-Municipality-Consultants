import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nameHint, candidateSchema } from '../model/candidate.ts';
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
});
