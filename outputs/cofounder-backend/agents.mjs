import {projectDataVolumes,projectPrompt,projectDataToken} from './project-data-runtime.mjs';
import {applyConfig,publicConfig,commandAgentKey} from './agent-config.mjs';
import {db} from './db.mjs';
import {savedAgents,recordCommand,containerState,startRecord,saveAgent,validText,publishProfile} from './agent-records.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assistant,humans,privateDir,envFile} from './config.mjs';
const exec=promisify(execFile);
const container='cofounder-messaging-test-chat-agent-1';
const relayUrl='ws://127.0.0.1:3030';
async function docker(args){const r=await exec('docker',args,{timeout:20000,maxBuffer:100000});return r.stdout+(args[0]==='logs'?r.stderr:'');}
const settingsFile=path.join(privateDir,'cofounder-agent-settings.json');
function settings(){return fs.existsSync(settingsFile)?JSON.parse(fs.readFileSync(settingsFile,'utf8')):{};}
const defaultsFile=path.join(privateDir,'agent-defaults.json');
function defaults(){return fs.existsSync(defaultsFile)?JSON.parse(fs.readFileSync(defaultsFile,'utf8')):{preferred_runtime:'buzz-agent',provider:'openrouter',model:envFile('openrouter.env').OPENROUTER_MODEL,env_vars:{}};}
function configSurface(a){const field=value=>({value,origin:'buzzExplicit',writeVia:{type:'readOnly'},overriddenValue:null,overriddenOrigin:null,isRequired:false});return {runtimeId:a.runtime,runtimeLabel:'Buzz Agent',isPreSpawn:a.status!=='running',normalized:{model:field(a.model),provider:field(a.provider),systemPrompt:field(a.system_prompt),mode:null,thinkingEffort:null,maxOutputTokens:null,contextLimit:null},advanced:[],extensions:[],sources:{acpNative:'pending',acpConfigOptions:'pending',envVars:'available',configFile:'notApplicable',configFilePath:null,mcpConfigFilePath:null}};}

async function runtimeHealth(name,state){
 if(!state.Running)return state;
 try{const log=(await docker(['logs','--tail','60','--since',state.StartedAt,name])).replace(/\x1b\[[0-9;]*m/g,'');const latest=log.split('\n').filter(line=>line.includes('agent_returned')).at(-1)||'';
 if(latest.includes('age_18plus'))return {...state,Error:'OpenRouter requires 18+ confirmation for the selected model. Complete it at https://openrouter.ai/settings/preferences, or choose another model.'};
 if(latest.includes('Agent reported error'))return {...state,Error:'The selected model rejected the request. Check the agent activity log and provider configuration.'};
 }catch{}
 return state;
}
async function status(){return runtimeHealth(container,JSON.parse(await docker(['inspect','--format','{{json .State}}',container])));}
function prompt(){const yaml=fs.readFileSync(path.join(privateDir,'agent-compose.yml'),'utf8');return yaml.split('BUZZ_ACP_SYSTEM_PROMPT: >-')[1]?.split('    cap_drop:')[0]?.trim().replace(/\n\s+/g,' ')||'';}
function raw(s){return {pubkey:assistant.pubkey,name:'Co-founder',persona_id:null,runtime:'buzz-agent',relay_url:relayUrl,acp_command:'buzz-acp',agent_command:'buzz-agent',agent_args:[],mcp_command:'buzz-dev-mcp',turn_timeout_seconds:180,idle_timeout_seconds:120,max_turn_duration_seconds:180,parallelism:1,system_prompt:prompt(),avatar_url:null,model:envFile('openrouter.env').OPENROUTER_MODEL,provider:'openrouter',persona_out_of_date:false,persona_orphaned:false,needs_restart:false,restart_diff:[],env_vars:{},status:s.Running?'running':'stopped',pid:s.Running?s.Pid:null,created_at:s.StartedAt,updated_at:s.StartedAt,last_started_at:s.StartedAt,last_stopped_at:s.FinishedAt,last_exit_code:s.ExitCode,last_error:s.Error||null,last_error_code:null,log_path:'',start_on_app_launch:false,auto_restart_on_config_change:true,backend:{type:'local'},backend_agent_id:null,respond_to:'allowlist',respond_to_allowlist:[humans[1].pubkey],...settings()};}
function pair(s){return {pubkey:assistant.pubkey,relayUrl,localSetup:true,lifecycle:s.Running?'ready':'stopped',pid:s.Running?s.Pid:null,error:s.Error||null,logPath:null};}
async function executeAgentCommand({command,payload={}},actor){
 if(payload.expectedRelayUrl&&payload.expectedRelayUrl!==relayUrl)throw Error('Workspace changed. Please retry.');
 if(payload.expectedSignerPubkey&&payload.expectedSignerPubkey!==actor)throw Error('Account changed. Please retry.');
 if(payload.relayUrl&&payload.relayUrl!==relayUrl)throw Error('This agent runs in the local workspace.');
 const config=envFile('openrouter.env');
 if(command==='discover_agent_models'){
  if(payload.input?.provider!=='openrouter')throw Object.assign(Error('Live model discovery is available for the connected OpenRouter provider. Use a custom model ID for another provider.'),{status:400});
  const response=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Object.assign(Error('OpenRouter model discovery failed. Retry or enter a custom model ID.'),{status:503});
  const result=await response.json();
  return {agentName:'Buzz Agent',agentVersion:null,models:result.data.map(m=>({id:m.id,name:m.name,description:null})),agentDefaultModel:defaults().model,selectedModel:null,supportsSwitching:true};
 }
 if(command==='get_runtime_file_config')return payload.runtimeId==='buzz-agent'?{provider:'openrouter',model:config.OPENROUTER_MODEL,satisfiedEnvKeys:config.OPENROUTER_API_KEY?['OPENROUTER_API_KEY']:[]}:null;
 if(command==='get_global_agent_config')return publicConfig(defaults());
 if(command==='set_global_agent_config'){
  if(actor!==humans[0].pubkey)throw Object.assign(Error('Only the workspace owner can change agent defaults.'),{status:403});
  const c=payload.config;
  const checked=applyConfig(defaults(), {runtime:c.preferred_runtime,provider:c.provider,model:c.model,envVars:c.env_vars});c.env_vars=checked.env_vars;
  fs.writeFileSync(defaultsFile,JSON.stringify(c),{mode:0o600});
  // Current deployments have explicit provider/model pins; defaults affect new agents.
  return {config:publicConfig(c),restarted_count:0,failed_restart_count:0};
 }
 const rows=await savedAgents();
 const publicRow=async row=>({...raw(await runtimeHealth(row.data.container,await containerState(row.data.container))),...publicConfig(row.data),container:undefined});
 if(['list_personas','create_persona','update_persona','delete_persona','set_persona_active','create_managed_agent'].includes(command)){
  const result=await recordCommand(command,payload,actor);
  if(result?.row)return {...result,row:undefined,agent:await publicRow(result.row)};
  return result;
 }
 const target=rows.find(r=>r.id===commandAgentKey(payload));
 if(target){
  if(target.owner!==actor)throw Object.assign(Error('Only the agent owner can change it.'),{status:403});
  if(command==='set_managed_agent_start_on_app_launch'||command==='set_managed_agent_auto_restart'){
   const field=command==='set_managed_agent_start_on_app_launch'?'start_on_app_launch':'auto_restart_on_config_change';
   target.data[field]=field==='start_on_app_launch'?!!payload.startOnAppLaunch:!!payload.autoRestartOnConfigChange;
   await saveAgent(target);return publicRow(target);
  }
  if(command==='update_managed_agent'){
   const i=payload.input;

   const next=applyConfig(target.data,i);
   const wasRunning=(await containerState(target.data.container)).Running;
   const restart=target.data.auto_restart_on_config_change!==false||i.respondTo!==undefined||i.respondToAllowlist!==undefined;
   if(wasRunning&&!restart){next.needs_restart=true;target.data=next;await saveAgent(target);return {agent:await publicRow(target),profile_sync_error:null};}
   if(wasRunning)await docker(['stop',target.data.container]);
   target.data=next;await saveAgent(target);await publishProfile(target);
   if(wasRunning)await startRecord(target);
   return {agent:await publicRow(target),profile_sync_error:null};
  }
  if(command==='get_agent_models')return {agentName:target.data.name,agentVersion:null,models:[{id:target.data.model,name:target.data.model,description:null}],agentDefaultModel:target.data.model,selectedModel:target.data.model,supportsSwitching:false};
  if(command==='get_agent_config_surface')return configSurface(await publicRow(target));
  if(command==='get_managed_agent_log')return {content:(await docker(['logs','--tail','80',target.data.container])).replace(/sk-or-[\w-]+/g,'[redacted]'),log_path:''};
  if(command==='delete_managed_agent'){if((await containerState(target.data.container)).Running)await docker(['stop',target.data.container]);await db.query('DELETE FROM cofounder.agent_records WHERE id=$1 AND owner=$2',[target.id,actor]);return null;}
  if(command.startsWith('start_managed_agent')||command==='restart_managed_agent_runtime'){
   if(command==='restart_managed_agent_runtime')await docker(['stop',target.data.container]);
   await startRecord(target);
  }else if(command.startsWith('stop_managed_agent'))await docker(['stop',target.data.container]);
  else throw Object.assign(Error('This setting is not connected yet. No changes were applied.'),{status:400});
  const state=await containerState(target.data.container);
  return command.endsWith('_runtime')?{...pair(state),pubkey:target.id}:await publicRow(target);
 }
 const s=await status();
 if(command==='list_relay_agents'||command==='revalidate_relay_agents'){
  const directory=[{pubkey:assistant.pubkey,owner_pubkey:humans[0].pubkey,name:raw(s).name,status:s.Running?'online':'offline',respond_to:raw(s).respond_to,respond_to_allowlist:raw(s).respond_to_allowlist},...await Promise.all(rows.map(async r=>({pubkey:r.id,owner_pubkey:r.owner,name:r.data.name,status:(await containerState(r.data.container)).Running?'online':'offline',respond_to:r.data.respond_to,respond_to_allowlist:r.data.respond_to_allowlist})))];
  const members=(await db.query(`SELECT encode(m.pubkey,'hex') AS pubkey,m.channel_id::text,c.name FROM channel_members m JOIN channels c ON c.id=m.channel_id AND c.community_id=m.community_id JOIN channel_members viewer ON viewer.channel_id=m.channel_id AND viewer.community_id=m.community_id AND viewer.pubkey=decode($1,'hex') AND viewer.removed_at IS NULL WHERE m.removed_at IS NULL AND c.deleted_at IS NULL`,[actor])).rows;
  const result=directory.map(a=>({...a,agent_type:'buzz-agent',capabilities:['messages','channels','mcp'],channel_ids:members.filter(m=>m.pubkey===a.pubkey).map(m=>m.channel_id),channels:members.filter(m=>m.pubkey===a.pubkey).map(m=>m.name)}));
  if(command==='list_relay_agents')return result;
  return result.filter(a=>(payload.pubkeys||[]).includes(a.pubkey)&&(!payload.channelId||a.channel_ids.includes(payload.channelId))&&(a.owner_pubkey===actor||a.respond_to==='anyone'||a.respond_to==='allowlist'&&a.respond_to_allowlist.includes(actor)));
 }
 if(command==='list_managed_agents')return [...(actor===humans[0].pubkey?[publicConfig(raw(s))]:[]),...await Promise.all(rows.filter(r=>r.owner===actor).map(publicRow))];
 if(command==='list_managed_agent_runtimes'||command==='reconcile_managed_agent_runtimes')return [...(actor===humans[0].pubkey?[pair(s)]:[]),...await Promise.all(rows.filter(r=>r.owner===actor).map(async r=>({...pair(await containerState(r.data.container)),pubkey:r.id})))];
 if(actor!==humans[0].pubkey)throw Error('Only the agent owner can manage Co-founder.');
 if(commandAgentKey(payload)!==assistant.pubkey)throw Object.assign(Error('Agent is not registered with the local service.'),{status:404});
 if(command==='set_managed_agent_start_on_app_launch'||command==='set_managed_agent_auto_restart'){
 const value=settings();value[command==='set_managed_agent_start_on_app_launch'?'start_on_app_launch':'auto_restart_on_config_change']=command==='set_managed_agent_start_on_app_launch'?!!payload.startOnAppLaunch:!!payload.autoRestartOnConfigChange;
 fs.writeFileSync(settingsFile,JSON.stringify(value),{mode:0o600});return publicConfig(raw(s));
 }
 if(command==='get_agent_models')return {agentName:raw(s).name,agentVersion:null,models:[{id:raw(s).model,name:raw(s).model,description:null}],agentDefaultModel:raw(s).model,selectedModel:raw(s).model,supportsSwitching:false};
 if(command==='get_agent_config_surface')return configSurface(raw(s));
 if(command==='update_managed_agent'){
  const next=applyConfig(raw(s),payload.input);
  const override={...settings(),name:next.name,system_prompt:next.system_prompt,model:next.model,provider:next.provider,respond_to:next.respond_to,respond_to_allowlist:next.respond_to_allowlist,parallelism:next.parallelism,agent_args:next.agent_args,env_vars:next.env_vars};
  const overlay=path.join(privateDir,'agent-settings-compose.json');
  fs.writeFileSync(overlay,JSON.stringify({services:{'chat-agent':{volumes:await projectDataVolumes(assistant.pubkey),environment:{...next.env_vars,BUZZ_PROJECT_DATA_TOKEN:await projectDataToken(assistant.pubkey),BUZZ_AGENT_PROVIDER:next.provider||'openrouter',BUZZ_ACP_DISPLAY_NAME:next.name,BUZZ_ACP_SYSTEM_PROMPT:projectPrompt(next.system_prompt),BUZZ_AGENT_MODEL:next.model||envFile('openrouter.env').OPENROUTER_MODEL,BUZZ_ACP_RESPOND_TO:next.respond_to,BUZZ_ACP_RESPOND_TO_ALLOWLIST:next.respond_to_allowlist.join(','),BUZZ_ACP_AGENTS:String(next.parallelism||1),...(next.agent_args?.length?{BUZZ_ACP_AGENT_ARGS:next.agent_args.join(',')}:{})}}}}),{mode:0o600});
  const accessChanged=payload.input.respondTo!==undefined||payload.input.respondToAllowlist!==undefined;
  if(s.Running&&next.auto_restart_on_config_change===false&&!accessChanged){override.needs_restart=true;fs.writeFileSync(settingsFile,JSON.stringify(override),{mode:0o600});return {agent:publicConfig(raw(s)),profile_sync_error:null};}
  if(s.Running)await docker(['stop',container]);
  fs.writeFileSync(settingsFile,JSON.stringify(override),{mode:0o600});
  await docker(['compose','-p','cofounder-messaging-test','-f',path.join(privateDir,'agent-compose.yml'),'-f',overlay,'create','chat-agent']);
  if(s.Running)await docker(['start',container]);
  return {agent:publicConfig(raw(await status())),profile_sync_error:null};
 }
 if(command==='get_managed_agent_log'){
 const content=await docker(['logs','--tail','80',container]);return {content:content.replace(/sk-or-[\w-]+/g,'[redacted]'),log_path:''};
 }
 const action={start_managed_agent:'start',stop_managed_agent:'stop',start_managed_agent_runtime:'start',stop_managed_agent_runtime:'stop',restart_managed_agent_runtime:'restart'}[command];
 if(action){
 const overlay=path.join(privateDir,'agent-settings-compose.json');
 if(action!=='stop'&&fs.existsSync(overlay)){
  if(s.Running)await docker(['stop',container]);
  await docker(['compose','-p','cofounder-messaging-test','-f',path.join(privateDir,'agent-compose.yml'),'-f',overlay,'create','chat-agent']);
  await docker(['start',container]);const value=settings();value.needs_restart=false;fs.writeFileSync(settingsFile,JSON.stringify(value),{mode:0o600});
 }else await docker([action,container]);
 const next=await status();return command.endsWith('_runtime')?pair(next):publicConfig(raw(next));
 }
 throw Object.assign(Error('This agent setting is not connected yet. No changes were applied.'),{status:400});
}

const writes=new Map();
export async function agentCommand(request,actor){
 if(/^(get_|list_|reconcile_)/.test(request.command))return executeAgentCommand(request,actor);
 const previous=writes.get(actor)||Promise.resolve();
 const operation=previous.catch(()=>{}).then(()=>executeAgentCommand(request,actor));
 writes.set(actor,operation);
 try{return await operation;}finally{if(writes.get(actor)===operation)writes.delete(actor);}
}

export async function startConfiguredAgents(){
 const failures=[];
 for(const row of await savedAgents())if(row.data.start_on_app_launch){try{await startRecord(row);}catch{failures.push(row.data.name);}}
 if(settings().start_on_app_launch){try{await docker(['start',container]);}catch{failures.push('Co-founder');}}
 if(failures.length)console.error('Agents failed to start:',failures.join(', '));
}
