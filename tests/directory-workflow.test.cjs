const test=require('node:test');
const assert=require('node:assert/strict');
const workflow=require('../docs/assets/directory-workflow.js');
function fixture(access) {
 const calls=[];
 const api={getAccess:async()=>{if(access instanceof Error)throw access;return access}};
 const views=Object.fromEntries(['enrollment','categories','profileReview','categoryReview','loadSuppliers'].map(name=>[name,async()=>{calls.push(name)}]));
 const ui=Object.fromEntries(['reset','showError','showEnrollment','showActive','showSupplierError'].map(name=>[name,(arg)=>calls.push([name,arg])]));
 return {calls,api,views,ui,user:{id:'user'}};
}
test('pending or revoked users never load supplier data',async()=>{
 const ctx=fixture({active:false,admin:false,manageProfiles:false});
 assert.equal(await workflow.initialize(ctx),'enrollment');assert.ok(ctx.calls.includes('enrollment'));
 assert.equal(ctx.calls.includes('loadSuppliers'),false);assert.equal(ctx.calls.includes('categories'),false);
});
test('scoped managers can review profiles but cannot open category administration',async()=>{
 const ctx=fixture({active:true,admin:false,manageProfiles:true});await workflow.initialize(ctx);
 assert.ok(ctx.calls.includes('loadSuppliers'));assert.ok(ctx.calls.includes('profileReview'));
 assert.equal(ctx.calls.includes('categoryReview'),false);
 assert.deepEqual(ctx.calls.find(item=>Array.isArray(item)&&item[0]==='showActive')[1],{canReviewProfiles:true,canReviewCategories:false,canAddSupplier:false});
});
test('permission lookup failure fails closed without exposing data',async()=>{
 const ctx=fixture(Error('offline'));assert.equal(await workflow.initialize(ctx),'unavailable');
 assert.equal(ctx.calls.includes('loadSuppliers'),false);assert.ok(ctx.calls.some(item=>Array.isArray(item)&&item[0]==='showError'));
});
