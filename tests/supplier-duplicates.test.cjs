const test = require('node:test');
const assert = require('node:assert/strict');

const context = {
  catalog: {
    suppliers:[{id:'a',display_name:'חברת אלון בעמ',status:'active'},
      {id:'b',display_name:'ספק אחר',status:'active'}],
    names:[{supplier_id:'a',name:'אלון ייעוץ'}],
    registries:[{id:'r1',status:'active',owner_unit_id:'u1'},
      {id:'r2',status:'active',owner_unit_id:'u2'},
      {id:'r3',status:'active',owner_unit_id:null}],
    versions:[{id:'v1',registry_id:'r1'},{id:'v2',registry_id:'r2'},{id:'v3',registry_id:'r3'}],
    fields:[{registry_id:'r1'},{registry_id:'r2'},{registry_id:'r3'}],
  },
  identifiers:[{supplier_id:'b',value:'512345678'}],
};

test('finds similar names, former names and exact official numbers', async () => {
  const {duplicates} = await import('../web/src/duplicates.ts');
  assert.equal(duplicates(context,'חברת אלן בעמ','')[0].id, 'a');
  assert.equal(duplicates(context,'אלון ייעוץ','')[0].id, 'a');
  assert.equal(duplicates(context,'לא דומה','512345678')[0].id, 'b');
});

test('offers editors only their unit and admins also unowned pools', async () => {
  const {writableVersions} = await import('../web/src/data/write-context.ts');
  const editor = {state:'active',admin:false,editor:true,grants:[{role:'editor',unitId:'u1'}]};
  assert.deepEqual(writableVersions(context.catalog,editor).map(row => row.versionId), ['v1']);
  assert.deepEqual(writableVersions(context.catalog,{...editor,admin:true}).map(row => row.versionId),
    ['v1','v2','v3']);
});
