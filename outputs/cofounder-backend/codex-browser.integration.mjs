// Live model/browser evaluation against disposable working and broken apps.
// No customer services, email, or Lovable writes.
import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runBrowserTask, browserDir } from './codex-browser.mjs';
const server=http.createServer((req,res)=>{
 const broken=req.url==='/broken';
 res.setHeader('Content-Type','text/html');
 res.end(`<!doctype html><html><head><title>Browser worker evaluation</title></head><body><h1>Onboarding</h1><p>Rename the completed task.</p><label><input type="checkbox" checked disabled>Completed</label><p id="title"></p><button id="edit">Edit task</button><form id="form" hidden><label>New task name <input id="name" required></label><button>Save</button><button type="button" id="cancel">Cancel</button></form><script>
const key=${JSON.stringify(broken?'broken':'working')};
const title=document.querySelector('#title'),form=document.querySelector('#form'),input=document.querySelector('#name');
title.textContent=localStorage.getItem(key)||'Read handbook';
document.querySelector('#edit').onclick=()=>{form.hidden=false;input.value=title.textContent};
document.querySelector('#cancel').onclick=()=>{form.hidden=true};
form.onsubmit=e=>{e.preventDefault();if(!input.value.trim())return;title.textContent=input.value.trim();${broken?'':'localStorage.setItem(key,title.textContent);'}form.hidden=true};
</script></body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`,results=[];
try {
 for(const scenario of ['working','broken']){
  const result=await runBrowserTask({url:url+'/'+scenario,headless:true,instruction:'Verify that the completed task can be renamed to "QA renamed", that completion remains checked, and that the new name survives a browser reload. Use the browser navigation tool to reload the same URL. Report separate checks for rename, completion and persistence. A persistence failure must make the overall result failed. Use only visible UI and screenshots. Do not read JavaScript or source. This is disposable test data.',onProgress:async p=>console.log(scenario,p.tool,p.status)});
  results.push({scenario,...result});
  assert.equal(result.status,scenario==='working'?'passed':'failed');
  assert.ok(result.toolCalls>=3);
 }
 fs.writeFileSync(path.join(browserDir,'evaluation.json'),JSON.stringify(results,null,2),{mode:0o600});
 console.log('PASS: Codex verified working UI and detected broken persistence.',JSON.stringify(results.map(r=>({scenario:r.scenario,status:r.status,runId:r.runId,checks:r.checks}))));
} finally{server.close();}
