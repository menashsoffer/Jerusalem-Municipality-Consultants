import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { handle } from '../identifier-feasibility/index.ts';

const ENV = { url: 'https://project.test', anonKey: 'anon-key' };
type Access = Record<string, boolean>;
const EDITOR: Access = { member: true, editor: true, admin: false };
const VIEWER: Access = { member: true, editor: false, admin: false };

function requestUrl(input: Parameters<typeof fetch>[0]): URL {
  return new URL(input instanceof Request ? input.url : input.toString());
}

/** Answers the access check with `access`, and everything else with `upstream`. */
function fakeFetch(access: Access | number, upstream: typeof fetch): typeof fetch {
  return (input, init) => {
    if (requestUrl(input).pathname === '/rest/v1/rpc/my_access') {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('apikey'), 'anon-key');
      assert.equal(headers.get('authorization'), 'Bearer user-token');
      return Promise.resolve(
        typeof access === 'number' ? new Response('', { status: access }) : Response.json(access),
      );
    }
    return upstream(input, init);
  };
}

function post(body: unknown, token: string | null = 'user-token'): Request {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return new Request('https://local.test', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const NO_UPSTREAM: typeof fetch = () => {
  throw new Error('No upstream request is expected');
};

describe('identifier source feasibility probe', () => {
  it('queries public companies and reports GuideStar as unverified', async () => {
    const upstream: typeof fetch = (input) => {
      const url = requestUrl(input);
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
      post({ names: [' אורבניקס '] }),
      ENV,
      fakeFetch(EDITOR, upstream),
    );
    const result = (await response.json()) as {
      companies: { available: boolean }[];
      guidestar: { available: boolean };
    };
    assert.equal(result.companies[0]?.available, true);
    assert.equal(result.guidestar.available, false);
  });

  it('rejects invalid requests and reports upstream errors without inventing results', async () => {
    assert.equal((await handle(new Request('https://local.test'), ENV)).status, 405);
    const tooMany = await handle(
      post({ names: Array(11).fill('x') }),
      ENV,
      fakeFetch(EDITOR, NO_UPSTREAM),
    );
    assert.equal(tooMany.status, 400);
    const response = await handle(
      post({ names: ['x'] }),
      ENV,
      fakeFetch(EDITOR, () => Promise.resolve(new Response('', { status: 429 }))),
    );
    const result = (await response.json()) as {
      companies: { available: boolean; status: number }[];
    };
    assert.equal(result.companies[0]?.available, false);
    assert.equal(result.companies[0].status, 429);
  });

  it('requires a signed-in caller', async () => {
    const response = await handle(post({ names: ['x'] }, null), ENV, NO_UPSTREAM);
    assert.equal(response.status, 401);
    const rejected = await handle(post({ names: ['x'] }), ENV, fakeFetch(401, NO_UPSTREAM));
    assert.equal(rejected.status, 401);
  });

  it('lets editors and admins look up, but not viewers', async () => {
    const viewer = await handle(post({ names: ['x'] }), ENV, fakeFetch(VIEWER, NO_UPSTREAM));
    assert.equal(viewer.status, 403);
    const admin = { member: false, editor: false, admin: true };
    const upstream: typeof fetch = () =>
      Promise.resolve(Response.json({ success: true, result: { records: [] } }));
    const allowed = await handle(post({ names: ['x'] }), ENV, fakeFetch(admin, upstream));
    assert.equal(allowed.status, 200);
  });

  it('fails closed when the access check cannot run', async () => {
    const noEnv = await handle(post({ names: ['x'] }), null, NO_UPSTREAM);
    assert.equal(noEnv.status, 503);
    const broken = await handle(post({ names: ['x'] }), ENV, fakeFetch(500, NO_UPSTREAM));
    assert.equal(broken.status, 503);
  });
});
