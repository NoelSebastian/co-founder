import {db} from './db.mjs';
import {connection} from './slack/store.mjs';
import {call} from './slack/client.mjs';
import {operate} from './slack/operations.mjs';
export async function businessLovable(page,b,actor){
 const lock=await db.connect();
 try{
 await lock.query('SELECT pg_advisory_lock(hashtext($1))',['business-lovable:'+page.id]);
 page=(await lock.query('SELECT * FROM cofounder.business_pages WHERE id=$1',[page.id])).rows[0];
 let binding=page.lovable_thread;
 if(!binding){
 const rows=(await db.query("SELECT id FROM cofounder.slack_connections WHERE actor=$1 AND status='connected' ORDER BY created_at",[actor])).rows;
 if(!rows.length)throw Error('Connect Slack and Lovable in Slack settings first.');
 const c=await connection(actor,b.connection||rows[0].id);
 let cursor,bot;const seen=new Set();
 for(let i=0;i<100;i++){
 const r=await call(c,'users.list',{limit:100,cursor});
 bot=r.members?.find(u=>u.is_bot&&!u.deleted&&u.profile?.api_app_id==='A0A6M7SEHKJ');
 if(bot)break;
 cursor=r.response_metadata?.next_cursor;if(!cursor||seen.has(cursor))break;seen.add(cursor);
 }
 if(!bot)throw Error('Connect the official Lovable app to this Slack workspace first.');
 const dm=await call(c,'conversations.open',{users:bot.id,return_im:true});
 binding={connection:c.id,channel:dm.channel.id};
 await lock.query('UPDATE cofounder.business_pages SET lovable_thread=$2 WHERE id=$1',[page.id,binding]);
 }
 const c=await connection(actor,binding.connection);
 if(b.message){
 if(typeof b.message!=='string'||!b.message.trim()||b.message.length>3000)throw Error('Use 1–3,000 characters.');
 const content=binding.ts?b.message:(page.project_id?`Work on existing Lovable project ${page.project_id} (${page.title}). `:`Create a new Lovable project for the business page "${page.title}". `)+b.message+'\nDo not publish unless I explicitly request it. Return the Lovable project link in this thread.';
 const existing=(await db.query('SELECT payload FROM cofounder.slack_operations WHERE id=$1 AND connection=$2',[b.requestId,c.id])).rows[0];
 if(existing && existing.payload.channel!==binding.channel)throw Error('Request belongs to a different conversation.');
 const op=await operate(c,b.requestId,'send',existing?.payload||{channel:binding.channel,text:content,...(binding.ts?{thread_ts:binding.ts}:{})});
 if(op.status!=='delivered')throw Error(op.error||'Delivery is unconfirmed. Retry this same request to check its status.');
 if(!binding.ts){binding={...binding,ts:op.result.ts};await lock.query('UPDATE cofounder.business_pages SET lovable_thread=$2 WHERE id=$1',[page.id,binding]);}
 }
 let messages=[],cursor;const seen=new Set();
 if(binding.ts)for(let i=0;i<100;i++){
 const r=await call(c,'conversations.replies',{channel:binding.channel,ts:binding.ts,limit:100,cursor});messages.push(...(r.messages||[]));cursor=r.response_metadata?.next_cursor;if(!cursor||seen.has(cursor))break;seen.add(cursor);
 }
 const projectIds=[...new Set(messages.filter(m=>m.bot_id && m.user!==c.user_id).flatMap(m=>[...(JSON.stringify(m).matchAll(/https:\/\/lovable\.dev\/projects\/([a-f0-9-]{36})/g))].map(x=>x[1])))];
 return {binding:{...binding,user:c.user_id},messages,projectIds};
 }finally{await lock.query('SELECT pg_advisory_unlock(hashtext($1))',['business-lovable:'+page.id]);lock.release();}
}
