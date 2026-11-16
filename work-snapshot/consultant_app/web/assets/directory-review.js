/* Draft review views. All decisions and unit scope are enforced by RLS and RPC. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryReview = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function elements(doc) {
    return (tag, text, attrs = {}) => {
      const node = doc.createElement(tag);
      if (text) node.textContent = text;
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      return node;
    };
  }
  async function mountProfiles({container, api, document:doc = document}) {
    if (!container || !api) throw new Error('missing_context');
    const el=elements(doc), status=el('p','טוענים בקשות הצטרפות…',{role:'status','aria-live':'polite'});
    container.replaceChildren(status);
    let profiles, units;
    try { [profiles, units] = await Promise.all([api.listPendingProfiles(), api.listUnits()]); }
    catch { status.textContent='לא ניתן לטעון בקשות. בדקו הרשאות ונסו שוב.'; return; }
    const unitNames = new Map(units.map(unit=>[unit.id,unit.name]));
    const list=el('div'), heading=el('h2','בקשות הצטרפות ממתינות');
    status.textContent=profiles.length ? '' : 'אין בקשות ממתינות בתחום ההרשאה שלך.';
    container.replaceChildren(heading,status,list);
    for (const profile of profiles) {
      const card=el('section'), title=el('h3',profile.first_name+' '+profile.last_name);
      card.append(title, el('p','דוא״ל: '+(profile.email || 'לא צוין')),
        el('p','תפקיד: '+profile.job_title), el('p','יחידה: '+(unitNames.get(profile.unit_id) || 'יחידה לא זמינה')),
        el('p','טלפון: '+(profile.phone || 'לא צוין')), el('p','מטרת השימוש: '+profile.purpose));
      const noteLabel=el('label','הערה להחלטה (חובה בדחייה)');
      const note=el('textarea','',{maxlength:'2000'}); noteLabel.append(note); card.append(noteLabel);
      const approve=el('button','אישור צפייה',{type:'button'}), reject=el('button','דחייה',{type:'button'});
      const result=el('p','',{role:'status','aria-live':'polite'}); card.append(approve,reject,result); list.append(card);
      let saving=false;
      async function decide(decision) {
        if (saving) return;
        const message=note.value.trim();
        if (decision==='rejected' && message.length<2) { result.textContent='יש לציין סיבת דחייה.'; return; }
        saving=true; approve.disabled=true; reject.disabled=true; result.textContent='שומרים החלטה…';
        try {
          await api.decideProfile({userId:profile.user_id,decision,note:message});
          card.replaceChildren(title,el('p',decision==='active'?'הבקשה אושרה ונוספה הרשאת צפייה.':'הבקשה נדחתה.'));
        } catch { result.textContent='לא ניתן לשמור את ההחלטה. ייתכן שהבקשה כבר טופלה או שההרשאה השתנתה.'; saving=false; approve.disabled=false; reject.disabled=false; }
      }
      approve.addEventListener('click',()=>decide('active'));
      reject.addEventListener('click',()=>decide('rejected'));
    }
  }
  async function mountCategories({container, api, document:doc = document}) {
    if (!container || !api) throw new Error('missing_context');
    const el=elements(doc), status=el('p','טוענים בקשות לקטגוריות…',{role:'status','aria-live':'polite'});
    container.replaceChildren(status);
    let requests,categories;
    try { [requests,categories]=await Promise.all([api.listPendingCategoryRequests(),api.listCategories()]); }
    catch { status.textContent='לא ניתן לטעון בקשות. בדקו הרשאות ונסו שוב.'; return; }
    const names=new Map(categories.map(item=>[item.id,item.name]));
    const list=el('div'); status.textContent=requests.length?'':'אין בקשות ממתינות.';
    container.replaceChildren(el('h2','בקשות לקטגוריות'),status,list);
    for (const request of requests) {
      const card=el('section'),title=el('h3',request.proposed_name);
      card.append(title,el('p',request.description),el('p','קטגוריית אב: '+(request.parent_id?(names.get(request.parent_id)||'לא זמינה'):'קטגוריה ראשית')));
      if(request.source_reference) card.append(el('p','מקור: '+request.source_reference));
      const noteLabel=el('label','נימוק להחלטה'); const note=el('textarea','',{maxlength:'2000',required:''}); noteLabel.append(note); card.append(noteLabel);
      const categoryLabel=el('label','קישור לקטגוריה קיימת'); const select=el('select'); select.add(el('option','בחרו קטגוריה',{value:''}));
      for(const category of categories) select.add(el('option',(category.parent_id?(names.get(category.parent_id)||'')+' / ':'')+category.name,{value:category.id}));
      categoryLabel.append(select);card.append(categoryLabel);
      const approve=el('button','אישור ויצירת קטגוריה',{type:'button'}), link=el('button','קישור לקיימת',{type:'button'}), reject=el('button','דחייה',{type:'button'});
      const result=el('p','',{role:'status','aria-live':'polite'});card.append(approve,link,reject,result);list.append(card);
      let saving=false;
      async function decide(decision) {
        if(saving)return;
        const message=note.value.trim();
        if(message.length<2){result.textContent='יש לציין נימוק להחלטה.';return;}
        if(decision==='linked' && !categories.some(category=>category.id===select.value)){result.textContent='יש לבחור קטגוריה קיימת.';return;}
        saving=true;[approve,link,reject].forEach(button=>button.disabled=true);result.textContent='שומרים החלטה…';
        try {
          await api.decideCategory({requestId:request.id,decision,note:message,existingCategoryId:decision==='linked'?select.value:undefined});
          card.replaceChildren(title,el('p',decision==='approved'?'הקטגוריה נוצרה.':decision==='linked'?'הבקשה קושרה לקטגוריה קיימת.':'הבקשה נדחתה.'));
        } catch { result.textContent='לא ניתן לשמור את ההחלטה. ייתכן שהבקשה כבר טופלה או שקיימת קטגוריה בשם זה.';saving=false;[approve,link,reject].forEach(button=>button.disabled=false); }
      }
      approve.addEventListener('click',()=>decide('approved'));link.addEventListener('click',()=>decide('linked'));reject.addEventListener('click',()=>decide('rejected'));
    }
  }
  return Object.freeze({mountProfiles,mountCategories});
});
