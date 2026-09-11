import {projectDataVolumes,projectPrompt,projectDataToken} from './project-data-runtime.mjs';
import fs from 'node:fs';
import {applyConfig,publicConfig} from './agent-config.mjs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {generateSecretKey,getPublicKey,finalizeEvent} from 'nostr-tools';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {db} from './db.mjs';
import {privateDir,humans,envFile} from './config.mjs';
const exec=promisify(execFile), relay='http://127.0.0.1:3030';
const image='ghcr.io/block/buzz-sprig@sha256:55589713278d3ad52610bc965e3e94bc91460c2e18896ebdc55f50b5320398c1';
function defaults(){const file=path.join(privateDir,'agent-defaults.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{model:envFile('openrouter.env').OPENROUTER_MODEL,provider:'openrouter',env_vars:{}};}
let init;
export async function records(){await(init??=db.query('CREATE TABLE IF NOT EXISTS cofounder.agent_records(id text PRIMARY KEY,owner text NOT NULL,kind text NOT NULL,data jsonb NOT NULL)'));return db;}
export async function docker(args){try{return await exec('docker',args,{timeout:20000,maxBuffer:100000});}catch{throw Object.assign(Error('The agent service could not complete this action. Check Docker is running.'),{status:503});}}
export async function savedAgents(){await records();return (await db.query("SELECT * FROM cofounder.agent_records WHERE kind='agent'")).rows;}
export async function saveAgent(row){await records();await db.query("INSERT INTO cofounder.agent_records VALUES($1,$2,'agent',$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[row.id,row.owner,JSON.stringify(row.data)]);}
export async function containerState(name){try{return JSON.parse((await docker(['inspect','--format','{{json .State}}',name])).stdout);}catch{return {Running:false,Pid:null,Error:'Agent is not running'};}}
export async function publishProfile(row){const secret=Buffer.from(fs.readFileSync(path.join(privateDir,`agent-${row.id}.key`),'utf8'),'hex');const event=finalizeEvent({kind:0,created_at:Math.floor(Date.now()/1000),tags:[],content:JSON.stringify({name:row.data.name,display_name:row.data.name,bot:true,about:row.data.description||''})},secret);const body=JSON.stringify(event),url=relay+'/events';const auth=finalizeEvent({kind:27235,created_at:Math.floor(Date.now()/1000),content:'',tags:[['u',url],['method','POST'],['nonce',randomUUID()],['payload',createHash('sha256').update(body).digest('hex')]]},secret);const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Nostr '+Buffer.from(JSON.stringify(auth)).toString('base64')},body,signal:AbortSignal.timeout(10000)});if(!r.ok||(await r.json()).accepted===false)throw Error('Agent saved but its profile could not be published. Retry starting it.');}
export async function startRecord(row){
 const s=await containerState(row.data.container);if(s.Running)return;
 row.data.needs_restart=false;await saveAgent(row);
 await publishProfile(row);
 const secret=fs.readFileSync(path.join(privateDir,`agent-${row.id}.key`),'utf8').trim();
 const vars={BUZZ_PROJECT_DATA_TOKEN:await projectDataToken(row.id),...envFile('openrouter.env'),...row.data.env_vars,BUZZ_PRIVATE_KEY:secret,BUZZ_RELAY_URL:'ws://127.0.0.1:3030',BUZZ_ACP_AGENT_OWNER:row.owner,BUZZ_ACP_RESPOND_TO:row.data.respond_to,BUZZ_ACP_RESPOND_TO_ALLOWLIST:row.data.respond_to_allowlist.join(','),BUZZ_AGENT_PROVIDER:row.data.provider||'openrouter',BUZZ_AGENT_MODEL:row.data.model||envFile('openrouter.env').OPENROUTER_MODEL,BUZZ_ACP_AGENTS:String(row.data.parallelism||1),BUZZ_ACP_AGENT_COMMAND:'buzz-agent',BUZZ_ACP_MCP_COMMAND:'buzz-dev-mcp',BUZZ_ACP_LAZY_POOL:'true',BUZZ_ACP_DISPLAY_NAME:row.data.name,BUZZ_ACP_IDLE_TIMEOUT:'120',BUZZ_ACP_MAX_TURN_DURATION:'180',BUZZ_AGENT_MAX_ROUNDS:row.data.env_vars?.BUZZ_AGENT_MAX_ROUNDS||'8',BUZZ_AGENT_MAX_OUTPUT_TOKENS:row.data.env_vars?.BUZZ_AGENT_MAX_OUTPUT_TOKENS||'4096',...(row.data.agent_args?.length?{BUZZ_ACP_AGENT_ARGS:row.data.agent_args.join(',')}:{})};
 const file=path.join(privateDir,`agent-${row.id}.env`);fs.writeFileSync(file,Object.entries(vars).map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});
 try{await docker(['rm',row.data.container]);}catch{}
 const volumes=await projectDataVolumes(row.id);
 await docker(['run',...volumes.flatMap(v=>['--mount',`type=bind,source=${v.source},target=${v.target},readonly`]),'-d','--name',row.data.container,'--network','host','--env-file',file,'-e',`BUZZ_ACP_SYSTEM_PROMPT=Reply using the Buzz messaging CLI. Only act in conversations where you are a member. Never claim actions without evidence. ${projectPrompt(row.data.system_prompt)}`,'--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','768m','--cpus','1','--pids-limit','128',image]);
 await new Promise(resolve=>setTimeout(resolve,1000));
 const started=await containerState(row.data.container);
 if(!started.Running){const log=await docker(['logs','--tail','6',row.data.container]);throw Object.assign(Error('Agent did not start: '+(log.stderr||log.stdout||started.Error).replace(/sk-or-[\w-]+/g,'[redacted]').slice(-600)),{status:503});}
}

export function validText(v,max,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim())||v.includes('\0'))throw Object.assign(Error('Please enter valid agent details.'),{status:400});return v.trim();}
export async function recordCommand(command,p,owner){
 await records();
 if(command==='list_personas')return (await db.query("SELECT data FROM cofounder.agent_records WHERE kind='persona' AND owner=$1",[owner])).rows.map(r=>publicConfig(r.data));
 if(['update_persona','delete_persona','set_persona_active'].includes(command)){
 const id=p.input?.id||p.id;const row=(await db.query("SELECT * FROM cofounder.agent_records WHERE id=$1 AND owner=$2 AND kind='persona'",[id,owner])).rows[0];
 if(!row)throw Object.assign(Error('Agent definition not found.'),{status:404});
 const linked=(await savedAgents()).filter(a=>a.owner===owner&&a.data.persona_id===id);
 if(command==='delete_persona'){
  for(const a of linked){if((await containerState(a.data.container)).Running)await docker(['stop',a.data.container]);await db.query('DELETE FROM cofounder.agent_records WHERE id=$1 AND owner=$2',[a.id,owner]);}
  await db.query('DELETE FROM cofounder.agent_records WHERE id=$1 AND owner=$2',[id,owner]);return null;
 }
 const next=command==='set_persona_active'?{...row.data,is_active:!!p.active}:applyConfig(row.data,p.input);
 // Access changes cross the stop/persist/restart boundary, just like Buzz.
 const running=[];for(const a of linked){if((await containerState(a.data.container)).Running){await docker(['stop',a.data.container]);running.push(a.id);}}
 await db.query('UPDATE cofounder.agent_records SET data=$2 WHERE id=$1',[id,JSON.stringify(next)]);
 for(const a of linked){a.data={...a.data,name:next.display_name,description:next.description,system_prompt:next.system_prompt,model:next.model,provider:next.provider,env_vars:next.env_vars,avatar_url:next.avatar_url,respond_to:next.respond_to||a.data.respond_to,respond_to_allowlist:next.respond_to_allowlist||a.data.respond_to_allowlist,parallelism:next.parallelism||a.data.parallelism};await saveAgent(a);await publishProfile(a);if(next.is_active!==false&&running.includes(a.id))await startRecord(a);}
 return publicConfig(next);
 }
 if(command==='create_persona'){
 const i=p.input,id=randomUUID(),now=new Date().toISOString();const data=applyConfig({id,display_name:validText(i.displayName,80,true),description:i.description||null,system_prompt:validText(i.systemPrompt,12000),runtime:'buzz-agent',model:i.model||defaults().model,provider:i.provider||defaults().provider,avatar_url:i.avatarUrl||null,is_builtin:false,is_active:true,shared:false,source_team:null,catalog_source:null,env_vars:{},created_at:now,updated_at:now},i);await db.query("INSERT INTO cofounder.agent_records VALUES($1,$2,'persona',$3)",[id,owner,JSON.stringify(data)]);return publicConfig(data);
 }
 if(command==='create_managed_agent'){
 const i=p.input;const existing=(await savedAgents()).find(r=>r.owner===owner&&i.personaId&&r.data.persona_id===i.personaId);if(existing){let spawn_error=null;try{await startRecord(existing);}catch(e){spawn_error=e.message;}return {row:existing,private_key_nsec:'',profile_sync_error:null,spawn_error};}if(i.agentCommand&&i.agentCommand!=='buzz-agent')throw Object.assign(Error('Choose the Buzz Agent runtime for this local workspace.'),{status:400});if(i.backend?.type==='provider')throw Object.assign(Error('External agent hosting is not configured.'),{status:400});if((await savedAgents()).length>=4)throw Object.assign(Error('The local workspace supports four additional agents.'),{status:400});
 const definition=i.personaId?(await db.query("SELECT data FROM cofounder.agent_records WHERE id=$1 AND owner=$2 AND kind='persona'",[i.personaId,owner])).rows[0]?.data:null;
 if(i.personaId&&!definition)throw Object.assign(Error('Agent definition not found.'),{status:404});
 const configured=applyConfig(definition||{},i);
 const key=generateSecretKey(),id=getPublicKey(key),now=new Date().toISOString();const row={id,owner,data:{pubkey:id,name:validText(i.name,80,true),persona_id:i.personaId||null,container:'cofounder-agent-'+id.slice(0,16),system_prompt:validText(i.systemPrompt||'',12000),model:i.model||defaults().model,respond_to:configured.respond_to||'owner-only',respond_to_allowlist:configured.respond_to_allowlist||[],parallelism:configured.parallelism||1,agent_args:configured.agent_args||[],provider:configured.provider||defaults().provider,env_vars:{...defaults().env_vars,...definition?.env_vars,...configured.env_vars},created_at:now,updated_at:now}};
 fs.writeFileSync(path.join(privateDir,`agent-${id}.key`),Buffer.from(key).toString('hex'),{mode:0o600,flag:'wx'});await saveAgent(row);let profile_sync_error=null,spawn_error=null;try{await publishProfile(row);}catch(e){profile_sync_error=e.message;}if(i.spawnAfterCreate!==false)try{await startRecord(row);}catch(e){spawn_error=e.message;}return {row,private_key_nsec:'',profile_sync_error,spawn_error};
 }
 return undefined;
}
