import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {db} from './db.mjs';
import {privateDir,assistant,humans} from './config.mjs';
import {meridianSnapshot,readMeridian,updateMeridianDeal} from './meridian-data.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
let initialized;
export async function migrateProjectData(){await(initialized??=db.query(`
 CREATE TABLE IF NOT EXISTS cofounder.data_permissions(agent text NOT NULL,source text NOT NULL,access text NOT NULL CHECK(access IN ('none','read','write')),PRIMARY KEY(agent,source));
 CREATE TABLE IF NOT EXISTS cofounder.data_tokens(agent text PRIMARY KEY,hash text UNIQUE NOT NULL);
 CREATE TABLE IF NOT EXISTS cofounder.data_audit(id bigserial PRIMARY KEY,agent text NOT NULL,source text NOT NULL,operation text NOT NULL,details jsonb,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`));}
export function effectiveAccess(rules,agent,source){
 const rank={none:0,read:1,write:2};let level=2;
 for(const rule of rules)if((rule.agent==='*'||rule.agent===agent)&&(rule.source==='*'||rule.source===source))level=Math.min(level,rank[rule.access]);
 return ['none','read','write'][level];
}
async function agents(){return [{id:assistant.pubkey,name:'Co-founder'},...(await db.query("SELECT id,data->>'name' AS name FROM cofounder.agent_records WHERE kind='agent'")).rows];}
async function sources(client=db){return (await client.query("SELECT id,title,project_id,url FROM cofounder.business_pages WHERE url IS NOT NULL")).rows.map(p=>({...p,connected:p.project_id==='3aa831e2-c372-4898-85b1-4e72929a4682',resources:p.project_id==='3aa831e2-c372-4898-85b1-4e72929a4682'?['pipeline_summary','pipelines','stages','deals','companies','contacts','activities','tasks']:[]}));}
export async function provisionDataToken(agent){
 await migrateProjectData();
 const file=path.join(privateDir,`project-data-${agent}.token`);
 if(!fs.existsSync(file))fs.writeFileSync(file,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
 await db.query('INSERT INTO cofounder.data_tokens VALUES($1,$2) ON CONFLICT(agent) DO UPDATE SET hash=excluded.hash',[agent,hash(fs.readFileSync(file,'utf8').trim())]);return file;
}
export async function authenticateDataAgent(header){
 const token=header?.startsWith('Bearer ')?header.slice(7):'';
 if(!/^[a-f0-9]{64}$/.test(token))throw Object.assign(Error('Agent authentication required.'),{status:401});
 const row=(await db.query('SELECT agent FROM cofounder.data_tokens WHERE hash=$1',[hash(token)])).rows[0];
 if(!row||!(await agents()).some(a=>a.id===row.agent))throw Object.assign(Error('Agent access revoked.'),{status:403});return row.agent;
}
export async function dataPermissions(body,actor){
 if(actor!==humans[0].pubkey)throw Object.assign(Error('Only the project owner can change data access.'),{status:403});
 const availableAgents=await agents(),availableSources=await sources();
 if(body){
  if(!['none','read','write'].includes(body.access)||body.agent!=='*'&&!availableAgents.some(a=>a.id===body.agent)||body.source!=='*'&&!availableSources.some(s=>s.id===body.source))throw Object.assign(Error('Invalid data permission.'),{status:400});
  const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(98217412)');await c.query('INSERT INTO cofounder.data_permissions VALUES($1,$2,$3) ON CONFLICT(agent,source) DO UPDATE SET access=excluded.access',[body.agent,body.source,body.access]);await c.query('INSERT INTO cofounder.data_audit(agent,source,operation,details,status) VALUES($1,$2,\'permission\',$3,\'saved\')',[actor,body.source,JSON.stringify(body)]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 return {agents:availableAgents,sources:availableSources,rules:(await db.query('SELECT * FROM cofounder.data_permissions')).rows,audit:(await db.query('SELECT * FROM cofounder.data_audit ORDER BY id DESC LIMIT 30')).rows};
}
export async function projectDataRequest(agent,body){
 const c=await db.connect();let auditId;
 try{
  await c.query('SELECT pg_advisory_lock(98217412)');
  const rules=(await c.query('SELECT * FROM cofounder.data_permissions')).rows,available=await sources(c);
  if(body.operation==='list')return {sources:available.filter(s=>effectiveAccess(rules,agent,s.id)!=='none').map(s=>({...s,access:effectiveAccess(rules,agent,s.id)}))};
  const source=available.find(s=>s.id===body.source),permission=effectiveAccess(rules,agent,body.source);
  if(!source||permission==='none'||body.operation==='update_deal'&&permission!=='write')throw Object.assign(Error('Your project data access does not permit this request.'),{status:403});
  if(!source.connected)throw Object.assign(Error('This app is displayed, but its data connector is not configured.'),{status:409});
  if(!['read','update_deal'].includes(body.operation))throw Object.assign(Error('Unknown data operation.'),{status:400});
  auditId=(await c.query('INSERT INTO cofounder.data_audit(agent,source,operation,details,status) VALUES($1,$2,$3,$4,\'started\') RETURNING id',[agent,source.id,body.operation,JSON.stringify({resource:body.resource,id:body.id,patch:body.patch})])).rows[0].id;
  const result=body.operation==='update_deal'?await updateMeridianDeal(body.id,body.patch):body.resource==='pipeline_summary'?await meridianSnapshot():{source:source.title,fetched_at:new Date().toISOString(),resource:body.resource,rows:await readMeridian(body.resource)};
  await c.query("UPDATE cofounder.data_audit SET status='completed' WHERE id=$1",[auditId]);return result;
 }catch(e){if(auditId)await c.query("UPDATE cofounder.data_audit SET status='failed' WHERE id=$1",[auditId]);throw e;}
 finally{await c.query('SELECT pg_advisory_unlock(98217412)');c.release();}
}
