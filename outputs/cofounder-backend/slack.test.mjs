import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,unseal} from './slack/store.mjs';
import {validateOperation} from './slack/operations.mjs';
import {manifest} from './slack/oauth.mjs';
test('Slack credentials are authenticated encryption, not plaintext',()=>{const k=randomBytes(32),v={accessToken:'test-secret'};const a=seal(v,k);assert.ok(!a.includes(v.accessToken));assert.deepEqual(unseal(a,k),v);assert.notEqual(a,seal(v,k));assert.throws(()=>unseal(a,randomBytes(32)));const b=Buffer.from(a,'base64');b[15]^=1;assert.throws(()=>unseal(b.toString('base64'),k));});
test('message actions validate Slack IDs, timestamps, length and supported action',()=>{assert.doesNotThrow(()=>validateOperation('send',{channel:'C123',text:'Hello'}));for(const [kind,p] of [['send',{channel:'C123',text:''}],['send',{channel:'C123',text:'x'.repeat(4001)}],['edit',{channel:'C123',text:'edit',ts:'oops'}],['send',{channel:'https://evil',text:'hello'}],['react',{channel:'C123',ts:'1.000001',name:'../../'}],['arbitrary',{}]])assert.throws(()=>validateOperation(kind,p));});
test('Slack manifest requests personal scopes and excludes RTM-only markers',()=>{const m=manifest('https://test.example/slack/callback');assert.equal(m.oauth_config.scopes.bot,undefined);assert.ok(m.oauth_config.scopes.user.includes('chat:write'));assert.ok(m.oauth_config.scopes.user.includes('groups:history'));assert.equal(m.settings.socket_mode_enabled,true);assert.ok(!m.settings.event_subscriptions.user_events.includes('channel_marked'));});

test('reply broadcasts require a thread and boolean intent',()=>{assert.throws(()=>validateOperation('send',{channel:'C123',text:'hello',reply_broadcast:true}));assert.throws(()=>validateOperation('send',{channel:'C123',text:'hello',thread_ts:'1.000001',reply_broadcast:'true'}));assert.doesNotThrow(()=>validateOperation('send',{channel:'C123',text:'hello',thread_ts:'1.000001',reply_broadcast:true}));});

test('channel creation requires valid name and explicit visibility without an existing channel ID',()=>{
  for (const is_private of [false,true]) assert.doesNotThrow(()=>validateOperation('create-channel',{name:'qa-channel_1',is_private}));
  for (const name of ['', 'Uppercase', 'has space', 'a'.repeat(81), '../channel']) assert.throws(()=>validateOperation('create-channel',{name,is_private:true}));
  assert.throws(()=>validateOperation('create-channel',{name:'qa-channel'}));
  assert.throws(()=>validateOperation('create-channel',{name:'qa-channel',is_private:'false'}));
});
