const test = require('node:test');
const assert = require('node:assert/strict');
const {createClient} = require('../docs/assets/directory-api.js');

test('access request includes only allowed fields and never lets the user set status', async () => {
  let body;
  const api = createClient({base: 'https://example.org', apiKey: 'public', accessToken: 'token',
    fetcher: async (_url, options) => { body = JSON.parse(options.body); return {ok: true}; }});
  await api.submitProfile({userId: 'user', firstName: '  א  ', lastName: 'ב', jobTitle: 'פקיד', unitId: 'unit', purpose: 'בקשת גישה', status: 'active'});
  assert.equal(body.first_name, 'א');
  assert.equal(body.status, undefined);
  assert.equal(body.user_id, 'user');
  assert.equal(body.unit_id, 'unit');
});

test('request failure and missing required information are reported', async () => {
  const api = createClient({base: 'https://example.org', apiKey: 'public', accessToken: 'token',
    fetcher: async () => ({ok: false, status: 403})});
  await assert.rejects(api.listCategories(), {code: 'not_authorized'});
  assert.throws(() => api.submitCategoryRequest({userId: 'user', name: 'א', description: 'תיאור ארוך'}), {code: 'invalid_name'});
});

test('category request cannot set its own decision or category', async () => {
  let request;
  const api = createClient({base: 'https://example.org', apiKey: 'public', accessToken: 'token',
    fetcher: async (_url, options) => { request = JSON.parse(options.body); return {ok: true}; }});
  await api.submitCategoryRequest({userId: 'user', name: 'שימור', description: 'שימור מבנים', status: 'approved', resolved_category_id: 'chosen'});
  assert.equal(request.status, undefined);
  assert.equal(request.resolved_category_id, undefined);
});

test('profile approval uses a single server-side decision operation', async () => {
  let call;
  const api = createClient({base: 'https://example.org', apiKey: 'public', accessToken: 'token',
    fetcher: async (url, options) => { call = {url, body: JSON.parse(options.body)}; return {ok: true}; }});
  await api.decideProfile({userId: 'user', decision: 'active', note: 'נבדק'});
  assert.equal(new URL(call.url).pathname, '/rest/v1/rpc/supplier_directory_decide_profile');
  assert.deepEqual(call.body, {target_user: 'user', decision: 'active', note: 'נבדק'});
  assert.throws(() => api.decideProfile({userId: 'user', decision: 'rejected', note: ''}), {code: 'invalid_note'});
  assert.throws(() => api.decideProfile({userId: 'user', decision: 'admin', note: 'x'}), {code: 'invalid_decision'});
});

test('category decisions validate linked categories and use one server operation', async () => {
  let call;
  const api = createClient({base: 'https://example.org', apiKey: 'public', accessToken: 'token',
    fetcher: async (url, options) => { call = {url, body: JSON.parse(options.body)}; return {ok: true}; }});
  await api.decideCategory({requestId: 'request', decision: 'linked', note: 'קיימת קטגוריה', existingCategoryId: 'category'});
  assert.equal(new URL(call.url).pathname, '/rest/v1/rpc/supplier_directory_decide_category');
  assert.equal(call.body.existing_category, 'category');
  assert.throws(() => api.decideCategory({requestId: 'request', decision: 'linked', note: 'קיים'}), {code: 'invalid_category'});
  assert.throws(() => api.decideCategory({requestId: 'request', decision: 'approved', note: 'מאושר', existingCategoryId: 'category'}), {code: 'invalid_category'});
});
