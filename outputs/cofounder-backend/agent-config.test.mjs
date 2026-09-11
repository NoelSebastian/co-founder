import test from 'node:test';
import assert from 'node:assert/strict';
import {applyConfig,publicConfig,commandAgentKey} from './agent-config.mjs';
test('Buzz edit and lifecycle commands resolve the same exact agent identity',()=>{
 const key='b'.repeat(64);
 assert.equal(commandAgentKey({pubkey:key}),key);
 assert.equal(commandAgentKey({input:{pubkey:key,systemPrompt:'updated'}}),key);
 assert.equal(commandAgentKey({input:{name:'Co-founder'}}),undefined);
});
test('Buzz access edits preserve absent fields and apply explicit changes',()=>{
 const before={system_prompt:'Keep me',respond_to:'allowlist',respond_to_allowlist:['a'.repeat(64)]};
 assert.equal(applyConfig(before,{name:'Research'}).respond_to,'allowlist');
 const after=applyConfig(before,{behavior:{respondTo:'owner-only',respondToAllowlist:[],parallelism:2}});
 assert.equal(after.respond_to,'owner-only');assert.deepEqual(after.respond_to_allowlist,[]);assert.equal(after.parallelism,2);assert.equal(after.system_prompt,'Keep me');
});
test('invalid changes reject without mutating saved configuration',()=>{
 const before={name:'Original'};
 for(const input of [{name:'hidden\u202evalue'},{provider:'x\nINJECT=yes'},{model:'x\nINJECT=yes'},{respondTo:'wrong'},{parallelism:0},{envVars:{BUZZ_PRIVATE_KEY:'replace'}}])assert.throws(()=>applyConfig(before,input));
 assert.deepEqual(before,{name:'Original'});
});
test('masked credentials survive unrelated saves and explicit clearing works',()=>{
 const before={env_vars:{OPENROUTER_API_KEY:'fake-test-credential-0'}};
 const display=publicConfig(before);assert.equal(display.env_vars.OPENROUTER_API_KEY,'••••••');
 assert.equal(applyConfig(before,{envVars:display.env_vars}).env_vars.OPENROUTER_API_KEY,'fake-test-credential-0');
 assert.deepEqual(applyConfig(before,{envVars:{}}).env_vars,{});
});
