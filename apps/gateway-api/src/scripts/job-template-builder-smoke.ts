import { randomBytes, randomUUID } from "node:crypto";
import { closePool, query } from "../lib/db.js";
import { hashPassword } from "../auth/password.js";

const baseUrl=process.env.BASE_URL||"http://127.0.0.1:8015";
const marker=`JOB-BUILDER-SMOKE-${Date.now()}`;
const password=`A!${randomBytes(12).toString("hex")}`;
const employerEmail=`employer.${randomUUID()}@example.invalid`;
const applicantEmail=`applicant.${randomUUID()}@example.invalid`;
const adminEmail=`admin.${randomUUID()}@example.invalid`;
let employerId="",applicantId="",adminId="",jobId="";
async function http(path:string,init?:RequestInit){return fetch(`${baseUrl}${path}`,init);}
async function login(email:string){const r=await http('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,rememberMe:false})});if(r.status!==200)throw new Error(`LOGIN_${r.status}`);const x=await r.json() as any;return String(x.accessToken||'');}
const auth=(token:string)=>({Authorization:`Bearer ${token}`});
async function createUser(email:string,role='public'){const hash=await hashPassword(password);const r=await query<{id:string}>(`INSERT INTO users(email,username,password_hash,full_name,name,phone_number,phone,role,status) VALUES($1,$2,$3,$4,$4,$5,$5,$6,'active') RETURNING id`,[email,`smoke_${randomUUID().replace(/-/g,'').slice(0,16)}`,hash,marker,`9617${Math.floor(1000000+Math.random()*8999999)}`,role]);return r.rows[0].id;}
async function main(){
 employerId=await createUser(employerEmail); applicantId=await createUser(applicantEmail); adminId=await createUser(adminEmail,'admin');
 await query(`INSERT INTO job_employer_accounts(user_id,organization_name,status) VALUES($1,$2,'APPROVED')`,[employerId,`${marker} ORG`]);
 const employerToken=await login(employerEmail), applicantToken=await login(applicantEmail), adminToken=await login(adminEmail);
 const denied=await http('/api/jobs/builder/jobs',{method:'POST',headers:{...auth(applicantToken),'Content-Type':'application/json'},body:JSON.stringify({title:'Denied',fields:[{fieldKey:'q_1',label:'Q',fieldType:'text',required:true}]})});
 if(denied.status!==403)throw new Error(`ORDINARY_BUILDER_EXPECTED_403_${denied.status}`);
 console.log('SMOKE_BUILDER_AUTHORIZATION=PASS');
 const create=await http('/api/jobs/builder/jobs',{method:'POST',headers:{...auth(employerToken),'Content-Type':'application/json'},body:JSON.stringify({title:`${marker} Job`,summary:'Synthetic',employmentType:'دوام كامل',workMode:'حضوري',governorate:'بيروت',fields:[{fieldKey:'experience_years',label:'سنوات الخبرة',fieldType:'number',required:true},{fieldKey:'shift',label:'الدوام',fieldType:'radio',required:true,options:['نهاري','ليلي']}]})});
 if(create.status!==201)throw new Error(`CREATE_JOB_${create.status}`);const created=(await create.json() as any).item;jobId=created.id;
 const publish=await http(`/api/jobs/builder/jobs/${jobId}/status`,{method:'PATCH',headers:{...auth(employerToken),'Content-Type':'application/json'},body:JSON.stringify({status:'PUBLISHED'})});if(publish.status!==200)throw new Error(`PUBLISH_${publish.status}`);
 const detail=await http(`/api/jobs/opportunities/${created.slug}`);if(detail.status!==200)throw new Error(`PUBLIC_DETAIL_${detail.status}`);
 console.log('SMOKE_EMPLOYER_BUILD_PUBLISH=PASS');
 const sources1=await http('/api/jobs/application-sources',{headers:auth(applicantToken)});if(sources1.status!==200)throw new Error(`SOURCES1_${sources1.status}`);const src1=await sources1.json() as any;if(!src1.profile?.name)throw new Error('PROFILE_SOURCE_MISSING');
 const apply=await http(`/api/jobs/opportunities/${created.slug}/apply`,{method:'POST',headers:{...auth(applicantToken),'Content-Type':'application/json'},body:JSON.stringify({name:src1.profile.name,phone:src1.profile.phone,email:src1.profile.email,answers:{experience_years:'7',shift:'نهاري'},prefillSource:'PROFILE',saveTemplateName:'Smoke Template'})});if(apply.status!==201)throw new Error(`APPLY_${apply.status}`);
 const again=await http(`/api/jobs/opportunities/${created.slug}/apply`,{method:'POST',headers:{...auth(applicantToken),'Content-Type':'application/json'},body:JSON.stringify({name:src1.profile.name,phone:src1.profile.phone,answers:{experience_years:'7',shift:'نهاري'}})});if(again.status!==409)throw new Error(`DUPLICATE_EXPECTED_409_${again.status}`);
 const sources2=await http('/api/jobs/application-sources',{headers:auth(applicantToken)});const src2=await sources2.json() as any;if(!src2.previousApplications?.some((x:any)=>x.label===`${marker} Job`))throw new Error('PREVIOUS_APPLICATION_SOURCE_MISSING');if(!src2.savedTemplates?.some((x:any)=>x.name==='Smoke Template'))throw new Error('SAVED_TEMPLATE_SOURCE_MISSING');
 console.log('SMOKE_PROFILE_PREVIOUS_TEMPLATE=PASS');
 const apps=await http(`/api/jobs/builder/jobs/${jobId}/applications`,{headers:auth(employerToken)});if(apps.status!==200)throw new Error(`APPLICATIONS_${apps.status}`);const ax=await apps.json() as any;const app=ax.items?.[0];if(!app)throw new Error('APPLICATION_MISSING');
 const follow=await http(`/api/jobs/builder/applications/${app.id}`,{method:'PATCH',headers:{...auth(employerToken),'Content-Type':'application/json'},body:JSON.stringify({status:'SHORTLISTED',employerNotes:'synthetic follow-up'})});if(follow.status!==200)throw new Error(`FOLLOWUP_${follow.status}`);
 console.log('SMOKE_APPLICATION_FOLLOWUP=PASS');
 const adminCreate=await http('/api/jobs/builder/jobs',{method:'POST',headers:{...auth(adminToken),'Content-Type':'application/json'},body:JSON.stringify({title:`${marker} Admin Job`,organizationName:'Admin Organization',fields:[{fieldKey:'note',label:'ملاحظة',fieldType:'text',required:true}]})});if(adminCreate.status!==201)throw new Error(`ADMIN_CREATE_${adminCreate.status}`);
 console.log('SMOKE_ADMIN_BUILDER=PASS');
 console.log('JOB_TEMPLATE_BUILDER_SMOKE=PASS');
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}).finally(async()=>{try{const ids=[employerId,applicantId,adminId].filter(Boolean);if(ids.length)await query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[ids]);if(ids.length)await query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);console.log('SMOKE_CLEANUP=PASS');}catch{console.error('SMOKE_CLEANUP=BLOCKED');process.exitCode=1;}finally{await closePool();}});