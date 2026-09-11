import test from 'node:test';import assert from 'node:assert/strict';
import {createDownloadTicket,consumeDownloadTicket} from './download-ticket.mjs';
test('download links are unguessable single-use capabilities with expiry',()=>{
 const file={name:'test.txt',base64:'YQ=='};
 const path=createDownloadTicket(file,1000); const id=path.split('/').at(-1);
 assert.match(id,/^[a-f0-9]{64}$/);assert.deepEqual(consumeDownloadTicket(id,1001),file);assert.equal(consumeDownloadTicket(id,1002),null);
 const expired=createDownloadTicket(file,1000).split('/').at(-1);assert.equal(consumeDownloadTicket(expired,61000),null);
 assert.equal(consumeDownloadTicket('fake',1001),null);
});
