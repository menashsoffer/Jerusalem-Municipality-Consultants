const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../docs/assets/directory-category-requests.js');
const forms = require('../docs/assets/directory-forms.js');
class Element {
  constructor(tag) { this.tag=tag; this.children=[]; this.attributes={}; this.listeners={}; this.value=''; this.disabled=false; }
  setAttribute(key,value) { this.attributes[key]=value; if(key==='value') this.value=value; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=items; if(this.tag==='select') this.value=''; }
  add(item) { this.children.push(item); }
  addEventListener(name,fn) { this.listeners[name]=fn; }
  reportValidity() { return true; }
  reset() {}
}
const document = {createElement:tag=>new Element(tag)};
function find(n,fn) { if(fn(n)) return n; for(const child of n.children) { const hit=find(child,fn); if(hit) return hit; } }
const categories=[{id:'r',name:'תכנון',parent_id:null},{id:'c',name:'תכנון עירוני',parent_id:'r'}];

test('submits request using a valid parent and refreshes own history', async () => {
  const container=new Element('div'); let submitted; let listCalls=0;
  const api={listCategories:async()=>categories, listMyCategoryRequests:async()=>{listCalls++;return []}, submitCategoryRequest:async input=>{submitted=input}};
  await view.mount({container,api,user:{id:'u'},forms,document});
  const field=name=>find(container,n=>n.attributes.name===name), form=find(container,n=>n.tag==='form');
  field('name').value='תכנון'; field('name').listeners.input();
  assert.match(find(container,n=>n.tag==='p' && /קטגוריות דומות/.test(n.textContent)).textContent,/תכנון/);
  field('parent').value='c'; await form.listeners.submit({preventDefault(){}}); assert.equal(submitted,undefined);
  field('parent').value='r'; field('description').value='צורך עסקי מפורט';
  await form.listeners.submit({preventDefault(){}});
  assert.equal(submitted.parentId,'r'); assert.equal(submitted.userId,'u'); assert.equal(listCalls,2);
  assert.match(find(container,n=>n.attributes.role==='status').textContent,/נשלחה/);
});

test('does not claim a request failed after save if history refresh fails', async () => {
  const container=new Element('div'); let count=0;
  const api={listCategories:async()=>categories, listMyCategoryRequests:async()=>{if(count++) throw Error('offline');return []}, submitCategoryRequest:async()=>{}};
  await view.mount({container,api,user:{id:'u'},forms,document});
  await find(container,n=>n.tag==='form').listeners.submit({preventDefault(){}});
  assert.match(find(container,n=>n.attributes.role==='status').textContent,/הבקשה נשלחה/);
  assert.match(find(container,n=>n.attributes.role==='status').textContent,/רענון/);
});

test('refuses to render a form if loading categories fails', async () => {
  const container=new Element('div');
  await view.mount({container,user:{id:'u'},forms,document,api:{listCategories:async()=>{throw Error('offline')},listMyCategoryRequests:async()=>[]}});
  assert.equal(find(container,n=>n.tag==='form'),undefined);
  assert.match(container.children[0].textContent,/לא ניתן לטעון/);
});
