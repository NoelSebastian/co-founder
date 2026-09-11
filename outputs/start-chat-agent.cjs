// Start the upstream runtime only after local provider configuration is ready.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'work/backend-test/openrouter.env');
if (!fs.existsSync(file)) {
  console.error('Run node outputs/prepare-chat-agent.cjs first.');
  process.exit(1);
}
const config = fs.readFileSync(file, 'utf8');
const key = config.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1].trim();
const model = config.match(/^OPENROUTER_MODEL=(.+)$/m)?.[1].trim();
if (!key || !/^sk-or-[A-Za-z0-9_-]+$/.test(key) || !model) {
  console.error('Add your OpenRouter API key and model to work/backend-test/openrouter.env locally. No agent was started.');
  process.exit(1);
}
fs.chmodSync(file, 0o600);
const result = spawnSync('docker', ['compose', '-f', 'work/backend-test/agent-compose.yml', 'up', '-d', 'chat-agent'], {cwd:root, stdio:'inherit'});
if (result.error) console.error('Docker could not be started.');
process.exitCode = result.status ?? 1;
