import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { handle } from '../identifier-feasibility/index.ts';

describe('identifier source feasibility probe', () => {
  it('queries public companies and reports GuideStar as unverified', async () => {
    const fetcher: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      assert.equal(url.searchParams.get('q'), 'אורבניקס');
      assert.equal(url.searchParams.get('limit'), '5');
      return Promise.resolve(
        Response.json({
          success: true,
          result: { total: 1, records: [{ 'שם חברה': 'אורבניקס' }] },
        }),
      );
    };
    const response = await handle(
      new Request('https://local.test', {
        method: 'POST',
        body: JSON.stringify({ names: [' אורבניקס '] }),
      }),
      fetcher,
    );
    const result = (await response.json()) as {
      companies: { available: boolean }[];
      guidestar: { available: boolean };
    };
    assert.equal(result.companies[0]?.available, true);
    assert.equal(result.guidestar.available, false);
  });
  it('rejects invalid requests and reports upstream errors without inventing results', async () => {
    assert.equal((await handle(new Request('https://local.test'))).status, 405);
    assert.equal(
      (
        await handle(
          new Request('https://local.test', {
            method: 'POST',
            body: JSON.stringify({ names: Array(11).fill('x') }),
          }),
        )
      ).status,
      400,
    );
    const response = await handle(
      new Request('https://local.test', { method: 'POST', body: JSON.stringify({ names: ['x'] }) }),
      () => Promise.resolve(new Response('', { status: 429 })),
    );
    const result = (await response.json()) as {
      companies: { available: boolean; status: number }[];
    };
    assert.equal(result.companies[0]?.available, false);
    assert.equal(result.companies[0].status, 429);
  });
});
