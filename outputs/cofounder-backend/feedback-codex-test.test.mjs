import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceChecks,validateAcceptance} from './feedback-codex-test.mjs';
test('a worker cannot pass by omitting an acceptance criterion',()=>{
 const result=validateAcceptance({status:'passed',checks:[{id:'add_complete',passed:true}]});
 assert.equal(result.status,'failed');
 assert.equal(result.checks.filter(c=>!c.passed).length,6);
});
test('all seven passing criteria are accepted',()=>{
 assert.equal(validateAcceptance({status:'passed',checks:acceptanceChecks.map(([id])=>({id,passed:true}))}).status,'passed');
});
test('blocked and failed browser outcomes stay non-passing',()=>{
 for(const status of ['blocked','failed'])assert.equal(validateAcceptance({status,checks:[]}).status,status);
});
