const test=require('node:test');
const assert=require('node:assert/strict');
const review=require('../docs/assets/directory-review.js');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.listeners={};this.value='';this.disabled=false;}
 setAttribute(key,value){this.attributes[key]=value;if(key==='value')this.value=value;}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 add(item){this.children.push(item);}
 addEventListener(name,fn){this.listeners[name]=fn;}
}
const document={createElement:tag=>new Element(tag)};
function find(n,fn){if(fn(n))return n;for(const child of n.children){const hit=find(child,fn);if(hit)return hit;}}
const button=(root,text)=>find(root,n=>n.tag==='button'&&n.textContent===text);

test('reviewer must explain a rejection and approval uses the server decision',async()=>{
 const container=new Element('div');let decision;
 const profile={user_id:'u',first_name:'יעל',last_name:'כהן',job_title:'מנהלת',unit_id:'d',purpose:'איתור ספקים'};
 await review.mountProfiles({container,document,api:{listPendingProfiles:async()=>[profile],listUnits:async()=>[{id:'d',name:'אגף'}],decideProfile:async v=>{decision=v}}});
 await button(container,'דחייה').listeners.click();assert.equal(decision,undefined);
 await button(container,'אישור צפייה').listeners.click();assert.deepEqual(decision,{userId:'u',decision:'active',note:''});
 assert.match(find(container,n=>n.tag==='section').children[1].textContent,/אושרה/);
});

test('category link requires an existing category and a reason',async()=>{
 const container=new Element('div');let decision;
 const api={listPendingCategoryRequests:async()=>[{id:'q',proposed_name:'מדידה',description:'צורך',parent_id:null}],listCategories:async()=>[{id:'r',name:'תכנון',parent_id:null}],decideCategory:async v=>{decision=v}};
 await review.mountCategories({container,document,api});
 await button(container,'קישור לקיימת').listeners.click();assert.equal(decision,undefined);
 find(container,n=>n.tag==='textarea').value='כפילות';
 find(container,n=>n.tag==='select').value='wrong';await button(container,'קישור לקיימת').listeners.click();assert.equal(decision,undefined);
 find(container,n=>n.tag==='select').value='r';await button(container,'קישור לקיימת').listeners.click();
 assert.deepEqual(decision,{requestId:'q',decision:'linked',note:'כפילות',existingCategoryId:'r'});
});

test('failed access does not expose any review actions',async()=>{
 const container=new Element('div');
 await review.mountProfiles({container,document,api:{listPendingProfiles:async()=>{throw Error('denied')},listUnits:async()=>[]}});
 assert.equal(find(container,n=>n.tag==='button'),undefined);assert.match(container.children[0].textContent,/הרשאות/);
});
