import {randomUUID} from 'node:crypto';
import {db} from './db.mjs';
import {call,field,buildStatus} from './lovable.mjs';
export function lovableReply(response){
 const answer=response?.response||response?.agent_response;
 if(typeof answer?.content==='string'){
  const text=answer.content.replace(/<lov-tool-use\b[^>]*>[\s\S]*?<\/lov-tool-use>/gi,'').replace(/<lov-tool-use\b[^>]*\/>/gi,'').trim();
  if(text)return text;
 }
 return typeof answer?.summary==='string'?answer.summary:'Lovable completed this request. The embedded app shows the published version.';
}
export async function editBusinessApp(page,message){
 const run={id:randomUUID(),status:'sending',started_at:new Date().toISOString()};
 const messages=[...page.messages,{role:'user',content:message}];
 const claimed=await db.query("UPDATE cofounder.business_pages SET messages=$2,run=$3 WHERE id=$1 AND messages=$4::jsonb AND (run IS NULL OR run->>'status' NOT IN ('sending','building')) RETURNING id",[page.id,JSON.stringify(messages),JSON.stringify(run),JSON.stringify(page.messages)]);
 if(!claimed.rowCount)throw Object.assign(Error('An edit is already in progress or this conversation changed. Refresh before sending another message.'),{status:409});
 try{
  const response=await call('send_message',{project_id:page.project_id,message,wait:false});
  run.message_id=field(response,['message_id','messageId']);run.thread_id=field(response,['thread_id','threadId']);
  if(!run.message_id)throw Error('Lovable did not return a build reference.');
  run.status='building';
 }catch{
  run.status='unknown';messages.push({role:'assistant',content:'I could not confirm whether Lovable received this request. I have not retried it, to avoid making the change twice. Check the Lovable project before sending it again.'});
 }
 await db.query('UPDATE cofounder.business_pages SET run=$2,messages=$3,updated_at=now() WHERE id=$1',[page.id,JSON.stringify(run),JSON.stringify(messages)]);
 return {messages,run};
}
let polling=false;
export async function pollBusinessEdits(){
 if(polling)return;polling=true;
 try{
  await db.query("UPDATE cofounder.business_pages SET run=jsonb_set(run,'{status}','\"unknown\"'::jsonb) WHERE run->>'status'='sending' AND (run->>'started_at')::timestamptz < now()-interval '3 minutes'");
  const rows=(await db.query("SELECT * FROM cofounder.business_pages WHERE run->>'status'='building'")).rows;
  for(const page of rows){
   const run=page.run;
   try{
    const response=await call('get_message',{project_id:page.project_id,message_id:run.message_id,...(run.thread_id?{thread_id:run.thread_id}:{})});
    const status=buildStatus(response);
    const finished=['completed','done','success'].includes(status),failed=['failed','error','cancelled','canceled'].includes(status);
    if(!finished&&!failed){if(Date.now()-Date.parse(run.started_at)>1800000)throw Error('timeout');continue;}
    run.status=finished?'completed':'failed';
    const reply=finished?lovableReply(response):'Lovable could not complete this request. You can describe a smaller change or try again.';
    await db.query('UPDATE cofounder.business_pages SET run=$2,messages=messages||$3::jsonb,updated_at=now() WHERE id=$1 AND run->>\'id\'=$4',[page.id,JSON.stringify(run),JSON.stringify([{role:'assistant',content:reply}]),run.id]);
   }catch{if(Date.now()-Date.parse(run.started_at)>1800000){run.status='unknown';await db.query('UPDATE cofounder.business_pages SET run=$2 WHERE id=$1',[page.id,JSON.stringify(run)]);}}
  }
 }finally{polling=false;}
}
