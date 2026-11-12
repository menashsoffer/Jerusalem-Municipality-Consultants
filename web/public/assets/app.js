'use strict';
const $ = s => document.querySelector(s);
const BASE=SiteData.BASE;
const SESSION_KEY='consultants-session-v1';
const PKCE_KEY='consultants-pkce-v1';
const search=$('#query'), registry=$('#registry'), fieldFilter=$('#field-filter'), result=$('#results'), addDialog=$('#add-dialog'), loginDialog=$('#login-dialog');
let session=null,user=null;
function text(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e}
function track(event_type,details={}){if(!session||!user)return;SiteData.track(session.token,{actor_id:user.id,event_type,details}).catch(()=>{});}
function showAccess(title,message){$('#access-title').textContent=title;$('#access-message').textContent=message;$('#access-status').hidden=false;$('#login-open').hidden=true;$('#logout').hidden=false}
function takeAuthError(){const url=new URL(location.href), fragment=new URLSearchParams(url.hash.slice(1));const error=url.searchParams.get('error')||fragment.get('error');const code=url.searchParams.get('error_code')||fragment.get('error_code');if(!error&&!code)return '';for(const key of ['error','error_code','error_description']){url.searchParams.delete(key);fragment.delete(key)}url.hash=fragment.toString();history.replaceState(null,'',url.pathname+url.search+url.hash);sessionStorage.removeItem(PKCE_KEY);return code==='bad_oauth_state'||code==='flow_state_expired'||code==='otp_expired'?'תוקף ניסיון ההתחברות פג. יש להתחיל התחברות חדשה.':'ההתחברות לא הושלמה. יש להתחיל מחדש או לפנות למנהל המערכת.'}
function takeSession(){const p=new URLSearchParams(location.hash.slice(1));if(p.has('access_token')){const token=p.get('access_token');const exp=Date.now()+Number(p.get('expires_in')||3600)*1000;sessionStorage.setItem(SESSION_KEY,JSON.stringify({token,exp}));history.replaceState(null,'',location.pathname+location.search)}try{const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');return s&&s.exp>Date.now()?s:null}catch{return null}}
async function googleSignIn(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  sessionStorage.setItem(PKCE_KEY,verifier);
  const params=new URLSearchParams({provider:'google',redirect_to:location.origin+location.pathname,code_challenge:challenge,code_challenge_method:'s256'});
  location.assign(BASE+'/auth/v1/authorize?'+params);
}
async function exchangeGoogleCode(){
  const url=new URL(location.href), code=url.searchParams.get('code');
  if(!code)return;
  url.searchParams.delete('code'); history.replaceState(null,'',url.pathname+url.search+url.hash);
  const verifier=sessionStorage.getItem(PKCE_KEY); sessionStorage.removeItem(PKCE_KEY);
  if(!verifier)throw Error('missing verifier');
  const res=await SiteData.exchangeCode(code,verifier);
  if(!res.ok)throw Error('exchange failed');
  const data=await res.json();
  if(!data.access_token||!data.expires_in)throw Error('invalid session');
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({token:data.access_token,exp:Date.now()+Number(data.expires_in)*1000}));
}
function options(){CatalogView.options()}
function render(){CatalogView.render()}
async function loadData(){if(!session)throw Error('auth');CatalogView.setSuppliers(await SiteData.catalog(session.token))}
async function init(){const authError=takeAuthError();if(authError)$('#login-message').textContent=authError;try{await exchangeGoogleCode()}catch{$('#login-message').textContent='ההתחברות לא הושלמה. יש לנסות שוב.'}session=takeSession();if(session){try{const res=await SiteData.currentUser(session.token);if(!res.ok)throw Error('auth');user=await res.json();const access=await SiteData.access(session.token,user.id);if(access.state!=='active'||!access.member){const messages={pending:['הבקשה ממתינה לאישור','אפשר לחזור לכאן לאחר אישור מנהל המערכת.'],rejected:['בקשת הגישה נדחתה','יש לפנות למנהל המערכת לבירור.'],blocked:['הגישה חסומה','יש לפנות למנהל המערכת לבירור.'],unregistered:['נדרשת בקשת גישה','יש לפנות למנהל המערכת לצורך רישום.'],active:['אין הרשאה פעילה','יש לפנות למנהל המערכת לבירור.']};showAccess(...messages[access.state]);return}try{await loadData()}catch{showAccess('הקטלוג עדיין אינו זמין','לא ניתן לטעון את הקטלוג. בדקו את החיבור או פנו למנהל המערכת.');return}$('#login-open').hidden=true;$('#logout').hidden=false;$('#private-content').hidden=false;$('#add-open').hidden=!SiteData.canAddSupplier();track('page_view',{page:location.pathname});return}catch{session=null;user=null;sessionStorage.removeItem(SESSION_KEY);$('#login-message').textContent='לא ניתן לאמת הרשאה. יש להתחבר מחדש או לפנות למנהל המערכת.'}}loginDialog.showModal()}
CatalogView.setOpenHandler(id=>{if(session)SupplierDetails.open(id,session.token)});$('#supplier-close').addEventListener('click',()=>SupplierDetails.close());
$('#google-login')?.addEventListener('click',()=>googleSignIn().catch(()=>{$('#login-message').textContent='לא ניתן להתחבר באמצעות Google כעת.'}));
let searchTimer;search.addEventListener('input',()=>{render();clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const term=search.value.trim().slice(0,200);if(term)track('search',{term})},900)});registry.addEventListener('change',()=>{options();render();track('filter',{registry:registry.value})});fieldFilter.addEventListener('change',()=>{render();track('filter',{field:fieldFilter.value})});$('#unit-filter').addEventListener('change',()=>{render();track('filter',{unit:$('#unit-filter').value})});$('#validity-filter').addEventListener('change',()=>{render();track('filter',{validity:$('#validity-filter').value})});$('#reset').addEventListener('click',()=>{search.value='';registry.value='';fieldFilter.value='';$('#unit-filter').value='';$('#validity-filter').value='';options();render()});$('#login-open').addEventListener('click',()=>loginDialog.showModal());$('#login-close').addEventListener('click',()=>loginDialog.close());$('#logout').addEventListener('click',()=>{sessionStorage.removeItem(SESSION_KEY);location.reload()});$('#access-logout').addEventListener('click',()=>{sessionStorage.removeItem(SESSION_KEY);location.reload()});$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const msg=$('#login-message');msg.textContent='שולח קישור...';const email=String(new FormData(e.currentTarget).get('email')||'').trim();try{const res=await SiteData.sendLink(email,location.origin+location.pathname);if(!res.ok)throw Error('auth');msg.textContent='אם החשבון מורשה, קישור כניסה נשלח לדוא״ל.'}catch{msg.textContent='לא ניתן לשלוח קישור כעת. בדקו את פרטי החשבון ונסו שוב.'}});
SupplierWrite.bind(async()=>{await loadData()});$('#add-open').addEventListener('click',()=>{if(session)SupplierWrite.open(session.token)});document.addEventListener('click',e=>{const target=e.target.closest('button, a');if(!target||!session)return;const action=target.id|| (target.classList.contains('supplier-detail-open')?'open_supplier':target.closest('.card')?'open_source':'other');if(action!=='other')track('action',{action})});init();
