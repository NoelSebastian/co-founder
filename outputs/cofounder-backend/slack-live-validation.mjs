import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from './db.mjs';
import {call} from './slack/client.mjs';
import {operate} from './slack/operations.mjs';
import {download} from './slack/files.mjs';
const passed=[];
try {
 const c=(await db.query('SELECT * FROM cofounder.slack_connections WHERE id=$1',['ba65e0b0-b2aa-46b9-aa2d-97fd2c59686e'])).rows[0];
 const channel='D0C0P9S17U3';
 const action=async(kind,p,id=randomUUID())=>{const r=await operate(c,id,kind,{channel,...p});assert.equal(r.status,'delivered',r.error);return r.result;};
 const id=randomUUID(), text='Disposable Slack validation '+id;
 const sent=await action('send',{text},id);assert.equal(sent.message.user,c.user_id);passed.push('authenticated identity');
 const again=await action('send',{text},id);assert.equal(again.ts,sent.ts);passed.push('duplicate request returns same message');
 await action('edit',{ts:sent.ts,text:text+' edited'});
 const h=await call(c,'conversations.history',{channel,oldest:sent.ts,latest:sent.ts,inclusive:true,limit:1});assert.equal(h.messages[0].text,text+' edited');passed.push('edit reflected in Slack');
 await action('react',{ts:sent.ts,name:'eyes'});
 let r=await call(c,'reactions.get',{channel,timestamp:sent.ts});assert(r.message.reactions.some(x=>x.name==='eyes'));passed.push('reaction in Slack');
 await action('unreact',{ts:sent.ts,name:'eyes'});
 r=await call(c,'reactions.get',{channel,timestamp:sent.ts});assert(!r.message.reactions?.some(x=>x.name==='eyes'));passed.push('reaction removal');
 const bytes=Buffer.from('Disposable Co-founder file round-trip validation.\n');
 const up=await action('upload',{name:'cofounder-slack-validation.txt',base64:bytes.toString('base64')});
 const file=up.files[0].id;const down=await download(c,file);assert.deepEqual(Buffer.from(down.base64,'base64'),bytes);passed.push('file upload and exact download');
 await call(c,'files.delete',{file});passed.push('disposable file cleanup');
 await action('delete',{ts:sent.ts});
 const deleted=await call(c,'conversations.history',{channel,oldest:sent.ts,latest:sent.ts,inclusive:true,limit:1});assert(!deleted.messages.some(m=>m.ts===sent.ts));passed.push('delete reflected in Slack');
 console.log(JSON.stringify({passed}));
} catch(e){console.log(JSON.stringify({passed,failed:e.message}));process.exitCode=1;}finally{await db.end();}
