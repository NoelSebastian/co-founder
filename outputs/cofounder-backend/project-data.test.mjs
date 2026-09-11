import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveAccess} from './project-data.mjs';
import {summarizePipeline} from './meridian-data.mjs';
test('every agent and future source inherits read/write access',()=>{
 assert.equal(effectiveAccess([],'new-agent','new-source'),'write');
});
test('agent, source and project restrictions cannot be overridden by a broader grant',()=>{
 assert.equal(effectiveAccess([{agent:'a',source:'*',access:'none'},{agent:'a',source:'s',access:'write'}],'a','s'),'none');
 assert.equal(effectiveAccess([{agent:'*',source:'s',access:'read'}],'a','s'),'read');
 assert.equal(effectiveAccess([{agent:'*',source:'*',access:'none'}],'new','new'),'none');
 assert.equal(effectiveAccess([{agent:'a',source:'s',access:'none'}],'b','s'),'write');
});
test('pipeline totals exclude closed and deleted deals and use each deal probability',()=>{
 const result=summarizePipeline([{id:'p',name:'Sales'}],[{id:'open',pipeline_id:'p',kind:'open',name:'Open',position:0},{id:'won',pipeline_id:'p',kind:'won',name:'Won',position:1}],[{pipeline_id:'p',stage_id:'open',value:100,probability:30},{pipeline_id:'p',stage_id:'won',value:500,probability:100},{pipeline_id:'p',stage_id:'open',value:999,probability:100,deleted_at:'today'}])[0];
 assert.equal(result.open_value,100);assert.equal(result.weighted_forecast,30);assert.equal(result.deal_count,2);
});
