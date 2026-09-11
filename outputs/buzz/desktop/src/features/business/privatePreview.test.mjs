import test from 'node:test';
import assert from 'node:assert/strict';
import {isPrivateLovablePreview} from './privatePreview.ts';
test('private previews never masquerade as publicly embeddable apps',()=>{
 assert.equal(isPrivateLovablePreview('https://id-preview--b290a389-9559-4f77-bc79-f5c6afbaae78.lovable.app/'),true);
 assert.equal(isPrivateLovablePreview('https://id-preview-d3d91f62--aa411508-5d3c-4416-a543-bcc3d9414ea3.lovable.app/'),true);
 assert.equal(isPrivateLovablePreview('https://meridian.lovable.app/'),false);
 assert.equal(isPrivateLovablePreview('https://id-preview--test.lovable.app.attacker.com/'),false);
 assert.equal(isPrivateLovablePreview(null),false);
});
