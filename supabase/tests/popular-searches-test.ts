import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { PGlite } from '@electric-sql/pglite';

import { ACCESS_FIXTURE, USERS } from './access-fixture.ts';
import { as, migratedDatabase } from './pglite.ts';

interface Popular {
  term: string;
  count: number;
}

function search(db: PGlite, user: string | null, term: string): Promise<unknown> {
  return as(db, user, () => db.query('select public.record_search($1)', [term]));
}

function popular(db: PGlite): Promise<Popular[] | undefined> {
  return as(db, USERS.viewer, async () => {
    const result = await db.query<{ value: Popular[] }>(
      "select public.home_overview()->'popular_searches' as value",
    );
    return result.rows[0]?.value;
  });
}

async function stored(db: PGlite): Promise<{ term: string; hits: number }[]> {
  const result = await db.query<{ term: string; hits: number }>(
    'select term, hits from private.search_terms order by term',
  );
  return result.rows;
}

describe('popular searches', () => {
  let db: PGlite;
  before(async () => {
    db = await migratedDatabase();
    await db.exec(ACCESS_FIXTURE);
  });
  after(async () => {
    await db.close();
  });

  it('keeps the words folded and counted, never who searched', async () => {
    await search(db, USERS.viewer, '  הדרכה ');
    await search(db, USERS.editor, 'הדרכה');
    await search(db, USERS.admin, 'Legal   Advice');
    assert.deepEqual(await stored(db), [
      { term: 'legal advice', hits: 1 },
      { term: 'הדרכה', hits: 2 },
    ]);
    const columns = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'private' and table_name = 'search_terms' order by column_name`,
    );
    assert.deepEqual(
      columns.rows.map((r) => r.column_name),
      ['day', 'hits', 'term'],
    );
  });

  it('drops a search with a digit, a single letter or too many letters', async () => {
    const before = await stored(db);
    for (const term of ['050-1234567', 'חברה 514', 'א', 'א'.repeat(41), '   ']) {
      await search(db, USERS.viewer, term);
    }
    assert.deepEqual(await stored(db), before);
  });

  it('shows the top three of the last 30 days, each searched at least 3 times', async () => {
    await db.exec(`
      insert into private.search_terms (term, day, hits) values
        ('הנדסה', private.israel_today() - 1, 5),
        ('אדריכלות', private.israel_today() - 2, 4),
        ('ייעוץ', private.israel_today() - 3, 3),
        ('ישן', private.israel_today() - 40, 50),
        ('נדיר', private.israel_today(), 1);`);
    await search(db, USERS.viewer, 'הדרכה');
    assert.deepEqual(await popular(db), [
      { term: 'הנדסה', count: 5 },
      { term: 'אדריכלות', count: 4 },
      { term: 'הדרכה', count: 3 },
    ]);
  });

  it('removes days older than 90 on the next search', async () => {
    await db.exec(`insert into private.search_terms (term, day) values
      ('עתיק', private.israel_today() - 91);`);
    await search(db, USERS.viewer, 'הנדסה');
    const old = await db.query('select 1 from private.search_terms where term = $1', ['עתיק']);
    assert.equal(old.rows.length, 0);
  });

  it('refuses visitors and users who are not active', async () => {
    for (const user of [null, USERS.pending, USERS.blocked]) {
      await assert.rejects(search(db, user, 'הנדסה'), /Only active members|permission denied/);
    }
  });

  it('keeps the table out of reach of signed-in users', async () => {
    await assert.rejects(
      as(db, USERS.admin, () => db.query('select * from private.search_terms')),
      /permission denied/,
    );
  });
});
