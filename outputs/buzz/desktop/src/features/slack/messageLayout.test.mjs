import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMessage} from './messageLayout.ts';
import {slackNativeEmoji} from './slackEmoji.ts';
const m=(ts,extra={})=>({ts:String(ts),user:'U1',...extra});
test('group only adjacent ordinary messages from the same author within five minutes',()=>{
 assert.equal(groupMessage(m(1000),m(1100)),true);
 assert.equal(groupMessage(m(1000),m(1300)),false);
 assert.equal(groupMessage(m(1000),m(1100,{user:'U2'})),false);
 assert.equal(groupMessage(m(1000,{subtype:'channel_join'}),m(1100)),false);
 assert.equal(groupMessage(m(1000),m(1100,{subtype:'thread_broadcast'})),false);
 assert.equal(groupMessage(m(1100),m(1000)),false);
});
test('never group messages across local midnight',()=>{
 const midnight=new Date(2026,8,10,0,0,0).getTime()/1000;
 assert.equal(groupMessage(m(midnight-1),m(midnight+1)),false);
});
test('standard emoji catalog resolves beyond quick reactions and Slack aliases',()=>{
 assert.equal(slackNativeEmoji.rocket,'🚀');
 assert.equal(slackNativeEmoji.thumbsup,'👍');
 assert(Object.keys(slackNativeEmoji).length>1000);
});
