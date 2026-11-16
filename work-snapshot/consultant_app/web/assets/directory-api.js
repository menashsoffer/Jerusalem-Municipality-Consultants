/* Client for the proposed directory schema. Authorization remains on the server. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryApi = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  class DirectoryError extends Error {
    constructor(code) { super(code); this.code = code; }
  }

  function createClient({base, apiKey, accessToken, fetcher = fetch}) {
    if (!base || !apiKey || !accessToken) throw new DirectoryError('missing_session');
    const headers = {'apikey': apiKey, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json'};
    async function request(table, {method = 'GET', params, body, responseKind = 'array'} = {}) {
      const url = new URL(base + '/rest/v1/' + table);
      for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
      const options = {method, headers: {...headers}};
      if (body !== undefined) { options.body = JSON.stringify(body); if (responseKind !== 'object') options.headers.Prefer = 'return=minimal'; }
      let response;
      try { response = await fetcher(url.toString(), options); }
      catch { throw new DirectoryError('network_error'); }
      if (!response.ok) throw new DirectoryError(response.status === 401 || response.status === 403 ? 'not_authorized' : 'request_failed');
      if (method !== 'GET' && responseKind !== 'object') return;
      const rows = await response.json();
      if (responseKind === 'object') {
        if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw new DirectoryError('invalid_response');
        return rows;
      }
      if (!Array.isArray(rows)) throw new DirectoryError('invalid_response');
      return rows;
    }

    function text(value, min, max, name) {
      const result = typeof value === 'string' ? value.trim() : '';
      if (result.length < min || result.length > max) throw new DirectoryError('invalid_' + name);
      return result;
    }

    return Object.freeze({
      getAccess: async () => {
        const access = await request('rpc/supplier_directory_my_access', {method: 'POST', body: {}, responseKind: 'object'});
        if (['active', 'admin', 'manage_profiles'].some(key => typeof access[key] !== 'boolean')) throw new DirectoryError('invalid_response');
        return Object.freeze({active: access.active, admin: access.admin, manageProfiles: access.manage_profiles});
      },
      listUnits: () => request('supplier_directory_units', {params: {select: 'id,name,kind,parent_id', active: 'eq.true', verified: 'eq.true', order: 'name.asc'}}),
      getProfile: async userId => {
        const id = text(userId, 1, 100, 'user');
        const rows = await request('supplier_directory_profiles', {params: {select: 'user_id,first_name,last_name,email,job_title,unit_id,status,review_note', user_id: 'eq.' + id}});
        if (rows.length > 1) throw new DirectoryError('invalid_response');
        return rows[0] || null;
      },
      submitProfile: input => {
        const body = {user_id: text(input.userId, 1, 100, 'user'),
          first_name: text(input.firstName, 1, 100, 'first_name'),
          last_name: text(input.lastName, 1, 100, 'last_name'),
          job_title: text(input.jobTitle, 1, 200, 'job_title'),
          unit_id: text(input.unitId, 1, 100, 'unit'),
          purpose: text(input.purpose, 5, 1000, 'purpose')};
        if (input.phone) body.phone = text(input.phone, 1, 80, 'phone');
        return request('supplier_directory_profiles', {method: 'POST', body});
      },
      listPendingProfiles: () => request('supplier_directory_profiles', {params: {
        select: 'user_id,first_name,last_name,email,job_title,phone,unit_id,purpose,created_at',
        status: 'eq.pending', order: 'created_at.asc'}}),
      decideProfile: ({userId, decision, note}) => {
        const target = text(userId, 1, 100, 'user');
        if (decision !== 'active' && decision !== 'rejected') throw new DirectoryError('invalid_decision');
        const cleanedNote = text(note || '', decision === 'rejected' ? 2 : 0, 2000, 'note');
        return request('rpc/supplier_directory_decide_profile', {method: 'POST', body: {
          target_user: target, decision, note: cleanedNote || null}});
      },
      listCategories: () => request('supplier_directory_categories', {params: {select: 'id,name,description,parent_id', active: 'eq.true', order: 'name.asc'}}),
      listMyCategoryRequests: userId => request('supplier_directory_category_requests', {params: {
        select: 'id,proposed_name,description,parent_id,status,decision_note,resolved_category_id,requested_at',
        requested_by: 'eq.' + text(userId, 1, 100, 'user'), order: 'requested_at.desc'}}),
      listPendingCategoryRequests: () => request('supplier_directory_category_requests', {params: {
        select: 'id,requested_by,proposed_name,description,parent_id,source_reference,requested_at',
        status: 'eq.pending', order: 'requested_at.asc'}}),
      decideCategory: ({requestId, decision, note, existingCategoryId}) => {
        const id = text(requestId, 1, 100, 'request');
        if (!['approved', 'linked', 'rejected'].includes(decision)) throw new DirectoryError('invalid_decision');
        if ((decision === 'linked') !== Boolean(existingCategoryId)) throw new DirectoryError('invalid_category');
        return request('rpc/supplier_directory_decide_category', {method: 'POST', body: {
          target_request: id, decision, note: text(note, 2, 2000, 'note'),
          existing_category: existingCategoryId ? text(existingCategoryId, 1, 100, 'category') : null}});
      },
      submitCategoryRequest: input => {
        const body = {requested_by: text(input.userId, 1, 100, 'user'),
          proposed_name: text(input.name, 2, 200, 'name'),
          description: text(input.description, 5, 2000, 'description')};
        if (input.parentId) body.parent_id = text(input.parentId, 1, 100, 'parent');
        if (input.sourceReference) body.source_reference = text(input.sourceReference, 1, 2000, 'source');
        return request('supplier_directory_category_requests', {method: 'POST', body});
      },
    });
  }
  return Object.freeze({createClient, DirectoryError});
});
