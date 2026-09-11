import {businessLovable} from './business-lovable.mjs';
import {editBusinessApp} from './business-chat.mjs';
import { randomUUID } from 'node:crypto';
import { db } from './db.mjs';
import { envFile, workspaceId, humans } from './config.mjs';
import { call } from './lovable.mjs';

export async function migrateBusinessPages() {
 await db.query(`CREATE TABLE IF NOT EXISTS cofounder.business_pages (id text PRIMARY KEY, title text NOT NULL, url text, project_id text, messages jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now())`);
 await db.query("ALTER TABLE cofounder.business_pages ADD COLUMN IF NOT EXISTS run jsonb");
 await db.query("ALTER TABLE cofounder.business_pages ADD COLUMN IF NOT EXISTS lovable_thread jsonb");
 await db.query("ALTER TABLE cofounder.business_pages ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'lovable'");
 await db.query("ALTER TABLE cofounder.business_pages ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false");
 await db.query(`INSERT INTO cofounder.business_pages(id,title,url,project_id) VALUES('sales-pipeline','Sales pipeline','https://id-preview--3aa831e2-c372-4898-85b1-4e72929a4682.lovable.app/pipeline','3aa831e2-c372-4898-85b1-4e72929a4682') ON CONFLICT DO NOTHING`);
}
function text(value,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Please enter a valid value.');return value.trim();}
export function appUrl(value){const u=new URL(text(value,2000));if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))throw Error('Use a public HTTPS app URL, without credentials.');return u.href;}
export async function businessPages(req,b,pubkey){
 const action=req.url;
 if(req.method==='GET'&&action==='/business/pages')return {pages:(await db.query('SELECT * FROM cofounder.business_pages WHERE hidden=false ORDER BY CASE WHEN id=\'sales-pipeline\' THEN 0 ELSE 1 END,updated_at')).rows};
 if(pubkey!==humans[0].pubkey)throw Error('Only the workspace owner can configure apps.');
 if(req.method==='GET'&&action==='/business/projects'){
  const r=await call('list_projects',{workspace_id:workspaceId,limit:100});
  return {projects:(r.projects||r.data||[]).map(p=>({id:p.id,title:p.display_name||p.name}))};
 }
 if(req.method!=='POST')throw Error('Unsupported request');
 if(action==='/business/create'){
  if(!['lovable','connector','build'].includes(b.mode))throw Error('Choose how to create your page.');
  const title=text(b.title,80);let url=null,projectId=null;
  if(b.mode==='lovable'){projectId=text(b.projectId,100);if(!/^[a-zA-Z0-9_-]+$/.test(projectId))throw Error('Invalid project');await call('get_project',{project_id:projectId});url=`https://id-preview--${projectId}.lovable.app`;}
  const id=randomUUID();await db.query('INSERT INTO cofounder.business_pages(id,title,mode,url,project_id) VALUES($1,$2,$3,$4,$5)',[id,title,b.mode,url,projectId]);return {id};
 }
 const page=(await db.query('SELECT * FROM cofounder.business_pages WHERE id=$1',[b.id])).rows[0];if(!page)throw Error('Page not found');
 if(action==='/business/lovable')return businessLovable(page,b,pubkey);
 if(action==='/business/remove'||action==='/business/restore'){
  await db.query('UPDATE cofounder.business_pages SET hidden=$2,updated_at=now() WHERE id=$1',[page.id,action==='/business/remove']);return {ok:true};
 }
 if(action==='/business/connect'){
  let url, projectId=null;
  if(b.projectId){
   projectId=text(b.projectId,100);const p=await call('get_project',{project_id:projectId});
   const candidate=p.project||p;const actualId=candidate.id||candidate.project_id||candidate.projectId;
   if(actualId&&actualId!==projectId)throw Error('Project mismatch');
   url=appUrl(candidate.preview_url||p.preview_url||`https://id-preview--${projectId}.lovable.app`);
  }else url=appUrl(b.url);
  await db.query('UPDATE cofounder.business_pages SET url=$2,project_id=$3,updated_at=now() WHERE id=$1',[page.id,url,projectId]);return {ok:true};
 }
 if(action==='/business/chat'&&page.project_id)return editBusinessApp(page,text(b.message,4000));
 if(action==='/business/chat'){
  const message=text(b.message,4000),previous=page.messages.slice(-24), env=envFile('openrouter.env');
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENROUTER_API_KEY}`},body:JSON.stringify({model:env.OPENROUTER_MODEL,max_tokens:600,messages:[{role:'system',content:`You are Co-founder helping configure a bespoke business app page called ${JSON.stringify(page.title)}. Ask one short useful question at a time. Help choose an existing Lovable app, connect an external app URL, or define a custom app to build over tools. The UI has an existing Lovable project picker and HTTPS app URL field. Not every service permits embedding; never claim integration or authentication succeeded. You cannot execute tools or create apps in this chat yet. You can prepare a concise build brief, and must explain that build dispatch is not available here yet if requested. Never ask for passwords or keys in chat. Do not invent projects, links, data, or completed work. Current connected URL: ${page.url||'none'}. Keep replies under 100 words.`},...previous,{role:'user',content:message}]}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('The agent could not respond. Please try again.');const r=await response.json(),answer=r.choices?.[0]?.message?.content;if(typeof answer!=='string'||!answer.trim())throw Error('The agent returned no response.');
  const messages=[...previous,{role:'user',content:message},{role:'assistant',content:answer}];
  const updated=await db.query('UPDATE cofounder.business_pages SET messages=$2,updated_at=now() WHERE id=$1 AND messages=$3::jsonb RETURNING id',[page.id,JSON.stringify(messages),JSON.stringify(page.messages)]);if(!updated.rowCount)throw Error('This page changed in another window. Refresh and retry.');return {messages};
 }
 throw Error('Unknown page action');
}
