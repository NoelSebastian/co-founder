// Real Buzz protocol test. Disposable identities are kept outside deliverables.
const { generateSecretKey, getPublicKey, finalizeEvent } = require('./buzz/desktop/node_modules/nostr-tools');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const stateFile = path.resolve(__dirname, '../work/backend-test/identities.json');
const relay = 'ws://127.0.0.1:3030';
let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile)) : {
  users: ['Noel', 'Alex', 'Uninvited'].map(name => {
    const secret = generateSecretKey();
    return { name, secret: Buffer.from(secret).toString('hex'), pubkey: getPublicKey(secret) };
  }),
  room: randomUUID(), messages: [],
};
function save() { writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 }); }
function event(user, kind, content, tags = []) {
  return finalizeEvent({ kind, content, tags, created_at: Math.floor(Date.now()/1000) }, Buffer.from(user.secret, 'hex'));
}
class Client {
  constructor(user) {
    this.user = user; this.inbox = []; this.waiters = [];
    this.socket = new WebSocket(relay);
    this.socket.addEventListener('message', e => {
      const msg = JSON.parse(e.data);
      const index = this.waiters.findIndex(w => w.match(msg));
      if (index >= 0) { const [w] = this.waiters.splice(index, 1); clearTimeout(w.timer); w.resolve(msg); }
      else this.inbox.push(msg);
    });
  }
  wait(match, timeout = 10000) {
    const index = this.inbox.findIndex(match);
    if (index >= 0) return Promise.resolve(this.inbox.splice(index,1)[0]);
    return new Promise((resolve,reject) => {
      const w = {match,resolve};
      w.timer = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); reject(new Error(`${this.user.name}: response timeout`)); }, timeout);
      this.waiters.push(w);
    });
  }
  send(data) { this.socket.send(JSON.stringify(data)); }
  async auth() {
    const challenge = await this.wait(m => m[0] === 'AUTH');
    const signed = event(this.user, 22242, '', [['relay', relay], ['challenge',challenge[1]]]);
    this.send(['AUTH', signed]);
    const ok = await this.wait(m => m[0] === 'OK' && m[1] === signed.id);
    assert.equal(ok[2], true, JSON.stringify(ok)); return this;
  }
  async publish(signed, accepted = true) {
    this.send(['EVENT', signed]);
    const ok = await this.wait(m => m[0] === 'OK' && m[1] === signed.id);
    if (accepted) assert.equal(ok[2], true, JSON.stringify(ok));
    return ok;
  }
  async history(room) {
    const id = randomUUID(); const items = [];
    this.send(['REQ', id, { kinds: [9], '#h': [room], limit: 100 }]);
    for (;;) {
      const m = await this.wait(m => ['EVENT','EOSE','CLOSED'].includes(m[0]) && m[1] === id);
      if (m[0] !== 'EVENT') { this.send(['CLOSE',id]); return {items, end: m}; }
      items.push(m[2]);
    }
  }
  close() { this.socket.close(); }
}
async function run() {
  const clients = state.users.map(u => new Client(u));
  try {
    const [a,b,c] = await Promise.all(clients.map(c => c.auth()));
    console.log('PASS: three independent identities authenticated');
    if (process.argv.includes('--after-restart')) {
      for (const client of [a,b]) {
        const {items} = await client.history(state.room);
        for (const id of state.messages) assert(items.some(m => m.id === id), 'Persisted message missing');
      }
      assert.equal((await c.history(state.room)).items.length,0);
      console.log('PASS: both users recover complete history after backend restart; outsider still denied');
      return;
    }
    // Every fresh run creates its own private room; no deletion of prior data.
    state.room = randomUUID(); state.messages = []; save();
    await a.publish(event(a.user,9007,'',[['h',state.room],['name','Co-founder test'],['channel_type','stream'],['visibility','private']]));
    await a.publish(event(a.user,9000,'',[['h',state.room],['p',b.user.pubkey]]));
    console.log('PASS: private room created and second user invited');
    for (const client of [a,b]) {
      client.send(['REQ','live',{kinds:[9],'#h':[state.room]}]);
      await client.wait(m => m[0] === 'EOSE' && m[1] === 'live');
    }
    const one = event(a.user,9,'Noel: let’s discuss onboarding.',[['h',state.room]]);
    await a.publish(one);
    assert.equal((await b.wait(m => m[0] === 'EVENT' && m[2].id === one.id))[2].pubkey,a.user.pubkey);
    const two = event(b.user,9,'Alex: let’s simplify the first step.',[['h',state.room]]);
    await b.publish(two);
    await a.wait(m => m[0] === 'EVENT' && m[2].id === two.id);
    state.messages.push(one.id,two.id); save();
    console.log('PASS: live delivery in both directions with correct authors');
    await a.publish(one); // identical retry must not create another stored message
    assert.equal((await b.history(state.room)).items.filter(m => m.id === one.id).length,1);
    console.log('PASS: identical send retry creates only one stored message');
    b.close();
    const three = event(a.user,9,'Noel: this message was sent while Alex was disconnected.',[['h',state.room]]);
    await a.publish(three); state.messages.push(three.id); save();
    const reconnect = new Client(b.user); clients.push(reconnect); await reconnect.auth();
    const recovered = (await reconnect.history(state.room)).items;
    for (const id of state.messages) assert(recovered.some(m => m.id === id));
    console.log('PASS: reconnect recovers messages sent while offline');
    assert.equal((await c.history(state.room)).items.length,0);
    const denied = await c.publish(event(c.user,9,'Unauthorized write',[['h',state.room]]),false);
    assert.equal(denied[2],false,'Outsider write accepted');
    console.log('PASS: uninvited identity cannot read or write private room');
    console.log('Run again with --after-restart after restarting the isolated backend.');
  } finally { for (const c of clients) c.close(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
