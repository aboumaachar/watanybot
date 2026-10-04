import { useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminNotice, AdminStatusBadge } from "../components/admin/AdminPrimitives";
import FormCreatorPlugin, { type FormCreatorField } from "../components/forms/FormCreatorPlugin";

type FormSettings = {
  accessMode:string; notifyApplicantOnSubmit:boolean; notifyApplicantOnStatusChange:boolean;
  notifyAdminsOnSubmit:boolean; submitLabel?:string;
};
type UniversalForm = {
  id:string; slug:string; name:string; description?:string; status:string; currentVersion:number;
  fields:FormCreatorField[]; settings:FormSettings; submissionCount:number; updatedAt:string;
};
type FormTemplate = {
  id:string; templateKey:string; name:string; description?:string; category:string;
  fields:FormCreatorField[]; settings:FormSettings; isSystem:boolean; updatedAt:string;
};
type Assignee = { id:string; name:string; email?:string; role:string };
type Submission = {
  id:string; reference:string; form_id:string; form_name:string; form_slug?:string; form_version:number;
  answers:Record<string,unknown>; identity_json?:Record<string,unknown>; status:string; workflow_state:string;
  assigned_user_id?:string|null; assigned_department?:string|null; assignee_name?:string; priority:string;
  due_at?:string|null; admin_notes?:string|null; public_note?:string|null; tags?:string[];
  attachment_count?:number; created_at:string; updated_at?:string;
};
type SubmissionEvent = { id:string; event_type:string; from_state?:string; to_state?:string; note?:string; payload_json?:Record<string,unknown>; actor_name?:string; created_at:string };
type SubmissionUpload = { id:string; field_key:string; original_name:string; mime_type:string; bytes:number; sha256:string; created_at:string };
type SubmissionDetail = { item:Submission; events:SubmissionEvent[]; uploads:SubmissionUpload[] };
type Editor = { id?:string; slug:string; name:string; description:string; fields:FormCreatorField[]; settings:FormSettings };

const DEFAULT_SETTINGS:FormSettings = {
  accessMode:"PUBLIC_ANONYMOUS", notifyApplicantOnSubmit:true,
  notifyApplicantOnStatusChange:true, notifyAdminsOnSubmit:true, submitLabel:"إرسال النموذج",
};
const EMPTY_EDITOR:Editor = { slug:"", name:"", description:"", fields:[], settings:{ ...DEFAULT_SETTINGS } };
const WORKFLOWS = ["SUBMITTED","ASSIGNED","IN_REVIEW","NEEDS_INFO","APPROVED","REJECTED","CLOSED","ARCHIVED"];
const PRIORITIES = ["LOW","NORMAL","HIGH","URGENT"];
const ACCESS_MODES = [
  ["PUBLIC_ANONYMOUS","عام بدون تسجيل"], ["PUBLIC_IDENTIFIED","عام مع هوية مقدم الطلب"],
  ["ACCOUNT_REQUIRED","يتطلب حساب موطني"], ["VERIFIED_ACCOUNT_REQUIRED","يتطلب حساباً موثّقاً"],
] as const;

function formatDate(value?:string|null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ar-LB");
}
function localDateTime(value?:string|null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0,16);
}
export default function UniversalFormsAdminPage() {
  const [forms,setForms]=useState<UniversalForm[]>([]);
  const [templates,setTemplates]=useState<FormTemplate[]>([]);
  const [submissions,setSubmissions]=useState<Submission[]>([]);
  const [assignees,setAssignees]=useState<Assignee[]>([]);
  const [editor,setEditor]=useState<Editor>(EMPTY_EDITOR);
  const [detail,setDetail]=useState<SubmissionDetail|null>(null);
  const [tab,setTab]=useState<"forms"|"submissions"|"templates">("forms");
  const [submissionFormId,setSubmissionFormId]=useState("");
  const [workflowFilter,setWorkflowFilter]=useState("");
  const [priorityFilter,setPriorityFilter]=useState("");
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const loadForms=async()=>{
    const response=await adminFetch("/api/admin/forms");
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json() as {items?:UniversalForm[]}; setForms(data.items||[]);
  };
  const loadTemplates=async()=>{
    const response=await adminFetch("/api/admin/forms/templates");
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json() as {items?:FormTemplate[]}; setTemplates(data.items||[]);
  };
  const loadAssignees=async()=>{
    const response=await adminFetch("/api/admin/forms/assignees");
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json() as {items?:Assignee[]}; setAssignees(data.items||[]);
  };
  const loadSubmissions=async(filters?:{formId?:string;workflow?:string;priority?:string})=>{
    const params=new URLSearchParams();
    const formId=filters?.formId ?? submissionFormId;
    const workflow=filters?.workflow ?? workflowFilter;
    const priority=filters?.priority ?? priorityFilter;
    if(formId) params.set("form_id",formId);
    if(workflow) params.set("workflow_state",workflow);
    if(priority) params.set("priority",priority);
    const response=await adminFetch(`/api/admin/forms/submissions/all?${params.toString()}`);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json() as {items?:Submission[]}; setSubmissions(data.items||[]);
  };
  const refresh=async()=>{
    setLoading(true); setError("");
    try { await Promise.all([loadForms(),loadTemplates(),loadAssignees(),loadSubmissions()]); }
    catch(reason){ setError(getAdminErrorMessage(reason,"تعذر تحميل منصة النماذج.")); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ void refresh(); },[]);

  const selected=useMemo(()=>forms.find((item)=>item.id===editor.id)??null,[forms,editor.id]);
  const resetEditor=()=>{ setEditor({ ...EMPTY_EDITOR, settings:{ ...DEFAULT_SETTINGS } }); setError(""); };
  const editForm=(item:UniversalForm)=>setEditor({ id:item.id,slug:item.slug,name:item.name,description:item.description||"",fields:item.fields||[],settings:{...DEFAULT_SETTINGS,...(item.settings||{})} });
  const saveForm=async()=>{
    if(!editor.name.trim()||!editor.slug.trim()){setError("اسم النموذج والرابط المختصر مطلوبان.");return;}
    setSaving(true);setError("");setNotice("");
    try{
      const response=await adminFetch(editor.id?`/api/admin/forms/${editor.id}`:"/api/admin/forms",{
        method:editor.id?"PUT":"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({name:editor.name.trim(),slug:editor.slug.trim(),description:editor.description.trim(),fields:editor.fields,settings:editor.settings}),
      });
      const data=await response.json() as {item?:UniversalForm;error?:string};
      if(!response.ok||!data.item) throw new Error(data.error||`HTTP ${response.status}`);
      editForm(data.item);setNotice("تم حفظ مسودة النموذج وإعداداته.");await loadForms();
    }catch(reason){setError(getAdminErrorMessage(reason,"تعذر حفظ النموذج."));}
    finally{setSaving(false);}
  };

  const publish=async(id:string)=>{
    setSaving(true);setError("");setNotice("");
    try{
      const response=await adminFetch(`/api/admin/forms/${id}/publish`,{method:"POST"});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      setNotice("تم نشر إصدار ثابت جديد من النموذج.");await loadForms();
    }catch(reason){setError(getAdminErrorMessage(reason,"تعذر نشر النموذج."));}
    finally{setSaving(false);}
  };
  const cloneForm=async(item:UniversalForm)=>{
    setError("");
    const response=await adminFetch(`/api/admin/forms/${item.id}/clone`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})});
    if(!response.ok){setError(`تعذر استنساخ النموذج (HTTP ${response.status}).`);return;}
    const data=await response.json() as {item:UniversalForm};await loadForms();editForm(data.item);setNotice("تم إنشاء نسخة مستقلة كمسودة.");
  };
  const archive=async(id:string)=>{
    const response=await adminFetch(`/api/admin/forms/${id}/status`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:"ARCHIVED"})});
    if(!response.ok){setError(`تعذر أرشفة النموذج (HTTP ${response.status}).`);return;}
    if(editor.id===id) resetEditor();setNotice("تمت أرشفة النموذج.");await loadForms();
  };
  const createFromTemplate=async(item:FormTemplate)=>{
    const slug=`${item.templateKey}-${Date.now().toString().slice(-6)}`;
    const response=await adminFetch(`/api/admin/forms/templates/${item.id}/create-form`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:item.name,slug})});
    const data=await response.json() as {item?:UniversalForm;error?:string};
    if(!response.ok||!data.item){setError(data.error||`HTTP ${response.status}`);return;}
    await loadForms();editForm(data.item);setTab("forms");setNotice("تم إنشاء مسودة من القالب.");
  };
  const saveAsTemplate=async(item:UniversalForm)=>{
    const response=await adminFetch(`/api/admin/forms/${item.id}/save-template`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:item.name,category:"GENERAL"})});
    if(!response.ok){setError(`تعذر حفظ القالب (HTTP ${response.status}).`);return;}
    setNotice("تم حفظ نسخة قابلة لإعادة الاستخدام في مكتبة القوالب.");await loadTemplates();
  };
  const openSubmission=async(id:string)=>{
    setError("");
    try{
      const response=await adminFetch(`/api/admin/forms/submissions/${id}`);
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      setDetail(await response.json() as SubmissionDetail);
    }catch(reason){setError(getAdminErrorMessage(reason,"تعذر فتح تفاصيل الطلب."));}
  };
  const patchSubmission=async(id:string,patch:Record<string,unknown>)=>{
    setSaving(true);setError("");
    try{
      const response=await adminFetch(`/api/admin/forms/submissions/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(patch)});
      const data=await response.json() as {error?:string};
      if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
      await Promise.all([loadSubmissions(),openSubmission(id)]);setNotice("تم تحديث مسار الطلب وتسجيل العملية.");
    }catch(reason){setError(getAdminErrorMessage(reason,"تعذر تحديث الطلب."));}
    finally{setSaving(false);}
  };
  const downloadUpload=async(item:SubmissionUpload)=>{
    const response=await adminFetch(`/api/admin/forms/uploads/${item.id}/content`);
    if(!response.ok){setError(`تعذر تنزيل المرفق (HTTP ${response.status}).`);return;}
    const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
    anchor.href=url;anchor.download=item.original_name;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
  };

  const settingsPatch=(patch:Partial<FormSettings>)=>setEditor((current)=>({...current,settings:{...current.settings,...patch}}));
  return <div className="universal-forms-admin" dir="rtl" data-universal-forms-admin="v3a">
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
      <button className={tab==="forms"?"accent":"ghost"} type="button" onClick={()=>setTab("forms")}>النماذج</button>
      <button className={tab==="submissions"?"accent":"ghost"} type="button" onClick={()=>setTab("submissions")}>الطلبات ({submissions.length})</button>
      <button className={tab==="templates"?"accent":"ghost"} type="button" onClick={()=>setTab("templates")}>القوالب ({templates.length})</button>
      <button className="ghost" type="button" disabled={loading} onClick={()=>void refresh()}>{loading?"جارٍ التحديث...":"تحديث"}</button>
    </div>
    <AdminNotice tone="info">FORM CREATOR V3A: منطق شرطي، خطوات/أقسام، مرفقات، أوضاع وصول، سير عمل للطلبات، تعيين وملاحظات وإشعارات وقوالب قابلة لإعادة الاستخدام.</AdminNotice>
    {error?<div className="alert" role="alert">{error}</div>:null}
    {notice?<div className="alert success" role="status">{notice}</div>:null}

    {tab==="forms"?<>
      <section className="admin-panel" style={{marginTop:14,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div><h3>{editor.id?"تعديل النموذج":"نموذج جديد"}</h3><p className="muted">المسودة قابلة للتعديل؛ النشر يثبت نسخة Version مستقلة للاستخدام العام والارتباط بالوحدات.</p></div>
          {editor.id?<button className="ghost" type="button" onClick={resetEditor}>نموذج جديد</button>:null}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
          <label><span>اسم النموذج *</span><input value={editor.name} onChange={(e)=>setEditor((c)=>({...c,name:e.target.value}))}/></label>
          <label><span>الرابط المختصر *</span><input dir="ltr" value={editor.slug} onChange={(e)=>setEditor((c)=>({...c,slug:e.target.value.replace(/[^A-Za-z0-9-]/g,"-").toLowerCase()}))}/></label>
          <label style={{gridColumn:"1/-1"}}><span>الوصف</span><textarea rows={2} value={editor.description} onChange={(e)=>setEditor((c)=>({...c,description:e.target.value}))}/></label>
        </div>
        <h4 style={{marginTop:14}}>إعدادات الوصول والإشعارات</h4>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
          <label><span>وضع الوصول</span><select value={editor.settings.accessMode} onChange={(e)=>settingsPatch({accessMode:e.target.value})}>{ACCESS_MODES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>نص زر الإرسال</span><input value={editor.settings.submitLabel||""} onChange={(e)=>settingsPatch({submitLabel:e.target.value})}/></label>
          <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={editor.settings.notifyApplicantOnSubmit} onChange={(e)=>settingsPatch({notifyApplicantOnSubmit:e.target.checked})}/><span>إشعار مقدم الطلب عند الإرسال</span></label>
          <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={editor.settings.notifyApplicantOnStatusChange} onChange={(e)=>settingsPatch({notifyApplicantOnStatusChange:e.target.checked})}/><span>إشعار مقدم الطلب عند تغير الحالة</span></label>
          <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={editor.settings.notifyAdminsOnSubmit} onChange={(e)=>settingsPatch({notifyAdminsOnSubmit:e.target.checked})}/><span>إشعار الإدارة عند وصول طلب جديد</span></label>
        </div>
        <div style={{marginTop:12}}><FormCreatorPlugin fields={editor.fields} onChange={(fields)=>setEditor((c)=>({...c,fields}))} title="منشئ النموذج V3A" description="أضف الحقول والأقسام والمرفقات والمنطق الشرطي وأعد ترتيبها."/></div>
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          <button className="accent" type="button" disabled={saving} onClick={()=>void saveForm()}>{saving?"جارٍ الحفظ...":"حفظ المسودة"}</button>
          {editor.id?<button className="ghost" type="button" disabled={saving} onClick={()=>void publish(editor.id!)}>نشر إصدار جديد</button>:null}
          {selected?.status==="PUBLISHED"?<a className="ghost" href={`/forms/live/${selected.slug}`} target="_blank" rel="noreferrer">معاينة عامة</a>:null}
        </div>
      </section>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>النموذج</th><th>الحالة</th><th>الإصدار</th><th>الوصول</th><th>الطلبات</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead><tbody>
        {forms.length===0?<tr><td colSpan={7} className="muted center">لا توجد نماذج بعد.</td></tr>:forms.map((item)=><tr key={item.id}>
          <td><strong>{item.name}</strong><div className="muted" dir="ltr">{item.slug}</div></td>
          <td><AdminStatusBadge status={item.status}/></td><td>{item.currentVersion}</td><td>{item.settings?.accessMode||"PUBLIC_ANONYMOUS"}</td><td>{item.submissionCount}</td><td>{formatDate(item.updatedAt)}</td>
          <td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="ghost sm" type="button" onClick={()=>editForm(item)}>تعديل</button>
            <button className="ghost sm" type="button" onClick={()=>void cloneForm(item)}>استنساخ</button>
            <button className="ghost sm" type="button" onClick={()=>void saveAsTemplate(item)}>حفظ كقالب</button>
            {item.status!=="ARCHIVED"?<button className="ghost sm danger" type="button" onClick={()=>void archive(item.id)}>أرشفة</button>:null}
            <button className="ghost sm" type="button" onClick={()=>{setSubmissionFormId(item.id);setTab("submissions");void loadSubmissions({formId:item.id});}}>الطلبات</button>
          </div></td>
        </tr>)}
      </tbody></table></div>
    </>:null}
    {tab==="submissions"?<>
      <section className="admin-panel" style={{marginTop:14,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,alignItems:"end"}}>
          <label><span>النموذج</span><select value={submissionFormId} onChange={(e)=>setSubmissionFormId(e.target.value)}><option value="">كل النماذج</option>{forms.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>مسار العمل</span><select value={workflowFilter} onChange={(e)=>setWorkflowFilter(e.target.value)}><option value="">كل الحالات</option>{WORKFLOWS.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>الأولوية</span><select value={priorityFilter} onChange={(e)=>setPriorityFilter(e.target.value)}><option value="">كل الأولويات</option>{PRIORITIES.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
          <button className="accent" type="button" onClick={()=>void loadSubmissions()}>تطبيق الفلاتر</button>
        </div>
      </section>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>المرجع</th><th>النموذج</th><th>الحالة</th><th>الأولوية</th><th>المعيّن</th><th>القسم</th><th>المرفقات</th><th>التاريخ</th><th></th></tr></thead><tbody>
        {submissions.length===0?<tr><td colSpan={9} className="muted center">لا توجد طلبات مطابقة.</td></tr>:submissions.map((item)=><tr key={item.id}>
          <td dir="ltr">{item.reference}</td><td>{item.form_name}<div className="muted">v{item.form_version}</div></td><td><AdminStatusBadge status={item.workflow_state||item.status}/></td><td>{item.priority||"NORMAL"}</td><td>{item.assignee_name||"-"}</td><td>{item.assigned_department||"-"}</td><td>{Number(item.attachment_count||0)}</td><td>{formatDate(item.created_at)}</td>
          <td><button className="ghost sm" type="button" onClick={()=>void openSubmission(item.id)}>فتح</button></td>
        </tr>)}
      </tbody></table></div>
      {detail?<section className="admin-panel" style={{marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><div><h3>{detail.item.form_name}</h3><div className="muted" dir="ltr">{detail.item.reference}</div></div><button className="ghost" type="button" onClick={()=>setDetail(null)}>إغلاق</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginTop:10}}>
          <label><span>مسار العمل</span><select disabled={saving} value={detail.item.workflow_state||detail.item.status} onChange={(e)=>void patchSubmission(detail.item.id,{workflowState:e.target.value})}>{WORKFLOWS.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>الأولوية</span><select disabled={saving} value={detail.item.priority||"NORMAL"} onChange={(e)=>void patchSubmission(detail.item.id,{priority:e.target.value})}>{PRIORITIES.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>المسؤول</span><select disabled={saving} value={detail.item.assigned_user_id||""} onChange={(e)=>void patchSubmission(detail.item.id,{assignedUserId:e.target.value||null})}><option value="">غير معيّن</option>{assignees.map((item)=><option key={item.id} value={item.id}>{item.name} — {item.role}</option>)}</select></label>
          <label><span>القسم</span><input defaultValue={detail.item.assigned_department||""} onBlur={(e)=>void patchSubmission(detail.item.id,{assignedDepartment:e.target.value})}/></label>
          <label><span>تاريخ الاستحقاق</span><input type="datetime-local" defaultValue={localDateTime(detail.item.due_at)} onBlur={(e)=>void patchSubmission(detail.item.id,{dueAt:e.target.value||null})}/></label>
          <label><span>الوسوم</span><input defaultValue={(detail.item.tags||[]).join(", ")} onBlur={(e)=>void patchSubmission(detail.item.id,{tags:e.target.value.split(",").map((v)=>v.trim()).filter(Boolean)})}/></label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10,marginTop:10}}>
          <label><span>ملاحظات داخلية</span><textarea rows={3} defaultValue={detail.item.admin_notes||""} onBlur={(e)=>void patchSubmission(detail.item.id,{adminNotes:e.target.value})}/></label>
          <label><span>ملاحظة ظاهرة لمقدم الطلب</span><textarea rows={3} defaultValue={detail.item.public_note||""} onBlur={(e)=>void patchSubmission(detail.item.id,{publicNote:e.target.value})}/></label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10,marginTop:12}}>
          <details open><summary>هوية مقدم الطلب</summary><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(detail.item.identity_json||{},null,2)}</pre></details>
          <details><summary>الإجابات</summary><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(detail.item.answers||{},null,2)}</pre></details>
        </div>
        <h4>المرفقات</h4>
        {detail.uploads.length? <div style={{display:"grid",gap:6}}>{detail.uploads.map((item)=><div key={item.id} style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><strong>{item.original_name}</strong><span className="muted">{item.mime_type} · {Math.ceil(item.bytes/1024)} KB</span><button className="ghost sm" type="button" onClick={()=>void downloadUpload(item)}>تنزيل</button></div>)}</div>:<p className="muted">لا توجد مرفقات.</p>}
        <h4>سجل النشاط</h4>
        {detail.events.length?<ul>{detail.events.map((event)=><li key={event.id}><strong>{event.event_type}</strong>{event.from_state||event.to_state?` · ${event.from_state||"-"} → ${event.to_state||"-"}`:""} · {formatDate(event.created_at)}{event.actor_name?` · ${event.actor_name}`:""}{event.note?` · ${event.note}`:""}</li>)}</ul>:<p className="muted">لا توجد أحداث إضافية.</p>}
      </section>:null}
    </>:null}

    {tab==="templates"?<section className="admin-panel" style={{marginTop:14}}>
      <div><h3>مكتبة القوالب</h3><p className="muted">ابدأ بنموذج جاهز ثم عدّل المسودة قبل النشر. القوالب النظامية لا تحتوي على طلبات أو بيانات مستخدمين.</p></div>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>القالب</th><th>التصنيف</th><th>النوع</th><th>الحقول</th><th>آخر تحديث</th><th></th></tr></thead><tbody>
        {templates.length===0?<tr><td colSpan={6} className="muted center">لا توجد قوالب بعد.</td></tr>:templates.map((item)=><tr key={item.id}><td><strong>{item.name}</strong><div className="muted">{item.description||""}</div></td><td>{item.category}</td><td>{item.isSystem?"نظامي":"مخصص"}</td><td>{item.fields?.length||0}</td><td>{formatDate(item.updatedAt)}</td><td><button className="accent sm" type="button" onClick={()=>void createFromTemplate(item)}>إنشاء نموذج</button></td></tr>)}
      </tbody></table></div>
    </section>:null}
  </div>;
}
