const test=require('node:test');
const assert=require('node:assert/strict');
const {search}=require('../docs/assets/directory-search.js');
const data={
 entities:[{id:'1',name:'אור תכנון'},{id:'2',name:'אור תכנון'}],
 memberships:[{id:'a',entity_id:'1',owner_unit_id:'u1',source_id:'s1',original_field:'תחבורה'},
 {id:'b',entity_id:'1',owner_unit_id:'u2',source_id:'s2',original_field:'חינוך'},
 {id:'c',entity_id:'2',owner_unit_id:'u1',source_id:'s1',original_field:'תכנון'}],
 assignments:[{membership_id:'a',category_id:'c1'},{membership_id:'a',category_id:'c2'},{membership_id:'b',category_id:'c3'},{membership_id:'c',category_id:'c1'}],
 categories:[{id:'r',name:'הנדסה',parent_id:null},{id:'c1',name:'מדידות',parent_id:'r'},{id:'c2',name:'כבישים',parent_id:'r'},{id:'c3',name:'חינוך',parent_id:null}],
 sources:[{id:'s1',title:'מאגר תחבורה'},{id:'s2',title:'מאגר חינוך'}]
};
test('category and department filters apply to the same membership',()=>{
 const result=search(data,{categoryId:'r',subcategoryId:'c2',unitId:'u1'});
 assert.deepEqual(result.map(row=>row.entity.id),['1']);assert.deepEqual(result[0].memberships.map(row=>row.id),['a']);
 assert.deepEqual(search(data,{categoryId:'r',unitId:'u2'}),[]);
});
test('identical names remain separate suppliers and category matches include children',()=>{
 assert.deepEqual(search(data,{query:'אור',categoryId:'r'}).map(row=>row.entity.id),['1','2']);
 assert.deepEqual(search(data,{query:'מאגר חינוך'}).map(row=>row.memberships[0].id),['b']);
});
test('a supplier can match multiple categories without duplicating the result',()=>{
 const rows=search(data,{categoryId:'r'});assert.equal(rows.length,2);assert.equal(rows[0].memberships.length,1);
});
