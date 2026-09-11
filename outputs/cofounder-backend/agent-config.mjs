// The web transport uses Buzz's existing configuration request shapes.
export function commandAgentKey(payload){return payload.pubkey||payload.input?.pubkey;}
export function invalid(message) { throw Object.assign(new Error(message), {status:400}); }
export function visibleText(value, max, required=false) {
 if(typeof value!=='string'||value.length>max||(required&&!value.trim())||/[\p{Default_Ignorable_Code_Point}\p{Bidi_Control}\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(value)) invalid('Please enter valid, visible agent details.');
 return value.trim();
}
export function applyConfig(previous, input) {
 const next={...previous};
 for(const [key,field,max] of [['name','name',80],['displayName','display_name',80],['systemPrompt','system_prompt',12000],['description','description',280]]) {
  if(input[key]!==undefined) next[field]=visibleText(input[key]??'',max,key==='name'||key==='displayName');
 }
 if(input.runtime && input.runtime!=='buzz-agent') invalid('This workspace currently runs Buzz Agent. This harness has not been installed.');
 if(input.acpCommand && input.acpCommand!=='buzz-acp')invalid('This workspace runs the installed buzz-acp command.');
 if(input.agentArgs!==undefined){if(!Array.isArray(input.agentArgs)||input.agentArgs.length>40||input.agentArgs.some(v=>typeof v!=='string'||/[\r\n\0,]/.test(v)))invalid('Invalid runtime arguments.');next.agent_args=input.agentArgs;}
 if(input.agentCommand && input.agentCommand!=='buzz-agent') invalid('Custom agent commands are not installed in this workspace.');
 if(input.provider && !/^[a-z0-9_-]+$/.test(input.provider)) invalid('Invalid provider.');
 if(input.model!==undefined) {
  if(input.model && !/^[a-zA-Z0-9_./:-]+$/.test(input.model)) invalid('Invalid model name.');
  next.model=input.model||null;
 }
 if(input.runtime!==undefined)next.runtime=input.runtime||null;
 if(input.provider!==undefined)next.provider=input.provider||null;
 if(input.avatarUrl!==undefined){if(input.avatarUrl&&!/^https:\/\//.test(input.avatarUrl))invalid('Use an HTTPS avatar URL.');next.avatar_url=input.avatarUrl||null;}
 const behavior=input.behavior??input;
 if(behavior.respondTo!==undefined){if(!['owner-only','allowlist','anyone'].includes(behavior.respondTo))invalid('Choose who can send instructions.');next.respond_to=behavior.respondTo;}
 if(behavior.respondToAllowlist!==undefined){if(!Array.isArray(behavior.respondToAllowlist)||behavior.respondToAllowlist.some(k=>! /^[0-9a-f]{64}$/.test(k)))invalid('Invalid allowed member.');next.respond_to_allowlist=[...new Set(behavior.respondToAllowlist)];}
 if(behavior.parallelism!==undefined){if(!Number.isInteger(behavior.parallelism)||behavior.parallelism<1||behavior.parallelism>32)invalid('Choose between one and 32 concurrent conversations.');next.parallelism=behavior.parallelism;}
 if(input.envVars!==undefined){
  const vars={};for(const [key,value] of Object.entries(input.envVars)){
   if(!/^[A-Z][A-Z0-9_]*$/.test(key)||/^(BUZZ_ACP_|BUZZ_PROJECT_|BUZZ_PRIVATE_KEY|BUZZ_RELAY_URL|PATH$|HOME$|LD_|NODE_OPTIONS|PYTHONPATH)/.test(key))invalid('This environment variable is reserved for the agent service.');
   if(typeof value!=='string'||/[\r\n\0]/.test(value)||value.length>16000)invalid('Invalid environment value.');
   const actual=value==='••••••'?previous.env_vars?.[key]:value;
   if(actual)vars[key]=actual;
  }next.env_vars=vars;
 }

 if(input.effortLevel!==undefined)invalid('This runtime has not reported support for changing effort.');
 next.updated_at=new Date().toISOString();
 return next;
}

export function publicConfig(data){return {...data,env_vars:Object.fromEntries(Object.keys(data.env_vars||{}).map(k=>[k,'••••••']))};}
