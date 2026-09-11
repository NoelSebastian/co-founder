import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { finalizeEvent } from 'nostr-tools';
import { humans, state, origin } from './config.mjs';
function request(who,path,body,method=body?'POST':'GET'){
 const raw=body?JSON.stringify(body):'';const tags=[['u',origin+path],['method',method],['nonce',randomUUID()]];
 if(raw)tags.push(['payload',createHash('sha256').update(raw).digest('hex')]);
 const auth=finalizeEvent({kind:27235,created_at:Math.floor(Date.now()/1000),content:'',tags},Buffer.from(who.secret,'hex'));
 return {method,headers:{Authorization:'Nostr '+Buffer.from(JSON.stringify(auth)).toString('base64'),...(raw?{'Content-Type':'application/json'}:{})},...(raw?{body:raw}:{})};
}
test('live endpoint requires membership, signed payload and single-use request',async()=>{
 assert.equal((await fetch(origin+'/workspace')).status,401);
 const outsider=state.users.find(u=>u.name==='Uninvited');
 assert.equal((await fetch(origin+'/workspace',request(outsider,'/workspace'))).status,401);
 const req=request(humans[0],'/workspace');assert.equal((await fetch(origin+'/workspace',req)).status,200);assert.equal((await fetch(origin+'/workspace',req)).status,401);
 const tampered=request(humans[0],'/priority',{title:'test',owner:'Noel'});tampered.body='{}';assert.equal((await fetch(origin+'/priority',tampered)).status,401);
});
test('unapproved or stale PRD versions cannot start a build',async()=>{
 const workspace=await (await fetch(origin+'/workspace',request(humans[0],'/workspace'))).json();
 const brief=workspace.briefs[0];assert.ok(brief);
 const r=await fetch(origin+'/build',request(humans[0],'/build',{id:brief.id,version:brief.version+1}));assert.equal(r.status,409);
 const stale=await fetch(origin+'/approve',request(humans[1],'/approve',{id:brief.id,version:brief.version+1}));assert.equal(stale.status,409);
});

test('a new draft cannot dispatch a build before approval',async()=>{
 const {db}=await import('./db.mjs');const id=randomUUID();
 try {
  await db.query("INSERT INTO cofounder.briefs(id,room,thread,title,version,content,author) VALUES($1,$2,'test','Approval guard test',1,'test',$3)",[id,state.room,humans[0].pubkey]);
  const r=await fetch(origin+'/build',request(humans[0],'/build',{id,version:1}));assert.equal(r.status,409);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cofounder.jobs WHERE brief_id=$1',[id])).rows[0].n,0);
 } finally {await db.query('DELETE FROM cofounder.briefs WHERE id=$1',[id]);await db.end();}
});
