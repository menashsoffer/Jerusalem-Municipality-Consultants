import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { probeGuideStar } from '../identifier-feasibility/guidestar.ts';

describe('GuideStar feasibility probe', () => {
  it('uses a session for queries, returns nonprofits only, and never returns the token', async () => {
    const fetcher: typeof fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/login')) {
        assert.equal(init?.redirect, 'error');
        return Promise.resolve(Response.json({ sessionId: 'secret-session' }));
      }
      assert.equal(url.searchParams.get('filter'), 'name=הסדנא');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer secret-session');
      return Promise.resolve(
        Response.json([
          { name: 'הסדנא', malkarType: 'עמותה', regNum: '580536878' },
          { name: 'הסדנא', malkarType: 'חברה', regNum: '123456789' },
        ]),
      );
    };
    const result = await probeGuideStar(
      ['הסדנא'],
      { username: 'user', password: 'secret' },
      fetcher,
    );
    const serialized = JSON.stringify(result);
    assert.match(serialized, /580536878/);
    assert.doesNotMatch(serialized, /123456789|secret/);
  });
  it('does not expose credentials or send queries if login fails', async () => {
    let calls = 0;
    const fetcher: typeof fetch = () => {
      calls += 1;
      return Promise.resolve(new Response('', { status: 401 }));
    };
    const result = await probeGuideStar(
      ['test'],
      { username: 'user', password: 'secret' },
      fetcher,
    );
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /secret/);
    assert.deepEqual(result, { available: false, reason: 'request failed' });
  });
});
