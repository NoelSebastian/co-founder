// Provision one disposable agent using the existing isolated Buzz relay.
// No provider credentials are read or printed by this script.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { generateSecretKey, getPublicKey, finalizeEvent } = require('./buzz/desktop/node_modules/nostr-tools');
const dir = path.resolve(__dirname, '../work/backend-test');
const relay = 'http://127.0.0.1:3030';
function signed(user, kind, content, tags = []) {
  return finalizeEvent({ kind, content, tags, created_at: Math.floor(Date.now()/1000) }, Buffer.from(user.secret, 'hex'));
}
async function publish(user, kind, content, tags) {
  const body = JSON.stringify(signed(user, kind, content, tags));
  const url = `${relay}/events`;
  const auth = signed(user, 27235, '', [['u', url], ['method', 'POST'], ['nonce', randomUUID()], ['payload', createHash('sha256').update(body).digest('hex')]]);
  const response = await fetch(url, {method: 'POST', headers: {'Content-Type':'application/json', Authorization:`Nostr ${Buffer.from(JSON.stringify(auth)).toString('base64')}`}, body, signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`Relay rejected provisioning: HTTP ${response.status}`);
  const result = await response.json();
  if (result.accepted === false || result.error) throw new Error('Relay rejected provisioning event');
}
async function main() {
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'identities.json')));
  const file = path.join(dir, 'agent-identity.json');
  let agent;
  if (fs.existsSync(file)) agent = JSON.parse(fs.readFileSync(file));
  else {
    const secret = generateSecretKey();
    agent = {name:'Co-founder', secret:Buffer.from(secret).toString('hex'), pubkey:getPublicKey(secret)};
    fs.writeFileSync(file, JSON.stringify(agent), {mode:0o600, flag:'wx'});
  }
  const noel = state.users.find(u => u.name === 'Noel');
  const alex = state.users.find(u => u.name === 'Alex');
  await publish(agent, 0, JSON.stringify({name:agent.name, display_name:agent.name, bot:true, about:'Shared planning assistant for Noel and Alex. Local integration test.'}));
  await publish(noel, 9000, '', [['h',state.room],['p',agent.pubkey]]);
  const env = {
    BUZZ_PRIVATE_KEY:agent.secret, BUZZ_ACP_AGENT_OWNER:noel.pubkey,
    BUZZ_ACP_RESPOND_TO:'allowlist', BUZZ_ACP_RESPOND_TO_ALLOWLIST:alex.pubkey,
  };
  fs.writeFileSync(path.join(dir, 'agent.env'), Object.entries(env).map(([k,v])=>`${k}=${v}\n`).join(''), {mode:0o600});
  const provider = path.join(dir, 'openrouter.env');
  if (!fs.existsSync(provider)) fs.writeFileSync(provider, '# Fill in locally; never paste this key into chat or commit this file.\nOPENROUTER_API_KEY=\nOPENROUTER_MODEL=anthropic/claude-sonnet-4.5\n', {mode:0o600, flag:'wx'});
  console.log('Provisioned Co-founder in the existing private test room. Provider configuration: work/backend-test/openrouter.env');
}
main().catch(e => {console.error(e.message); process.exitCode=1;});
