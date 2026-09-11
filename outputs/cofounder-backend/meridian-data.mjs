import fs from 'node:fs';
import path from 'node:path';
import {privateDir} from './config.mjs';
let session;
const resources=['pipelines','stages','deals','companies','contacts','activities','tasks'];
function config(){return JSON.parse(fs.readFileSync(path.join(privateDir,'meridian-data.json'),'utf8'));}
async function headers(){
 const c=config();
 if(!session||session.expires<Date.now()+60000){
  const r=await fetch(c.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({email:c.email,password:c.password}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Object.assign(Error('Meridian authentication failed. Its data has not been read.'),{status:502});
  const s=await r.json();session={token:s.access_token,expires:Date.now()+s.expires_in*1000};
 }
 return {apikey:c.key,Authorization:'Bearer '+session.token,'Content-Type':'application/json'};
}
export async function readMeridian(resource){
 if(!resources.includes(resource))throw Object.assign(Error('Unknown Meridian data resource.'),{status:400});
 const rows=[],h=await headers(),c=config();
 for(let offset=0;offset<100000;offset+=1000){
  const filter=['deals','companies','contacts','tasks'].includes(resource)?'&deleted_at=is.null':'';
  const r=await fetch(`${c.url}/rest/v1/${resource==='stages'?'pipeline_stages':resource}?select=*&order=id&limit=1000&offset=${offset}${filter}`,{headers:h,signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Object.assign(Error('Meridian did not return '+resource+'. No figures can be confirmed.'),{status:502});
  const batch=await r.json();if(!Array.isArray(batch))throw Error('Invalid Meridian response');rows.push(...batch);if(batch.length<1000)return rows;
 }
 throw Object.assign(Error('Meridian data exceeds the connector limit; no partial total was returned.'),{status:413});
}
export function summarizePipeline(pipelines,stages,deals){
 return pipelines.map(p=>{
  const columns=stages.filter(s=>s.pipeline_id===p.id).sort((a,b)=>a.position-b.position);
  const active=deals.filter(d=>d.pipeline_id===p.id&&!d.deleted_at);
  const open=active.filter(d=>columns.find(s=>s.id===d.stage_id)?.kind==='open');
  return {id:p.id,name:p.name,is_default:p.is_default,deal_count:active.length,open_deal_count:open.length,open_value:open.reduce((s,d)=>s+Number(d.value),0),weighted_forecast:open.reduce((s,d)=>s+Number(d.value)*Number(d.probability)/100,0),stages:columns.map(s=>({name:s.name,kind:s.kind,deal_count:active.filter(d=>d.stage_id===s.id).length,value:active.filter(d=>d.stage_id===s.id).reduce((n,d)=>n+Number(d.value),0)}))};
 });
}
export async function meridianSnapshot(){
 const [pipelines,stages,deals]=await Promise.all(['pipelines','stages','deals'].map(readMeridian));
 return {source:'Meridian CRM',source_url:'https://meridian-dealflow.lovable.app/pipeline',fetched_at:new Date().toISOString(),scope:'All owners; grouped by pipeline',pipelines:summarizePipeline(pipelines,stages,deals)};
}
export async function updateMeridianDeal(id,patch){
 if(!/^[a-f0-9-]{36}$/.test(id)||!patch||typeof patch!=='object'||Array.isArray(patch))throw Object.assign(Error('Invalid deal update.'),{status:400});
 const allowed=['name','value','probability','expected_close','forecast_category','lost_reason'];
 if(!Object.keys(patch).length||Object.keys(patch).some(k=>!allowed.includes(k)))throw Object.assign(Error('This connector supports editing deal name, value, probability, expected close, forecast category and lost reason.'),{status:400});
 if(patch.name!==undefined&&(typeof patch.name!=='string'||!patch.name.trim()||patch.name.length>255))throw Object.assign(Error('Invalid deal name.'),{status:400});
 for(const k of ['value','probability'])if(patch[k]!==undefined&&(!Number.isFinite(patch[k])||patch[k]<0||k==='probability'&&patch[k]>100))throw Object.assign(Error('Invalid '+k),{status:400});
 const r=await fetch(config().url+'/rest/v1/deals?id=eq.'+id,{method:'PATCH',headers:{...await headers(),Prefer:'return=representation'},body:JSON.stringify(patch),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Object.assign(Error('Meridian rejected the update.'),{status:502});
 const rows=await r.json();if(rows.length!==1)throw Object.assign(Error('Deal not found; no update confirmed.'),{status:404});return rows[0];
}
