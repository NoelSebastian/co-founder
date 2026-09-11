// A dedicated, visible Chrome profile for the local product's browser worker.
// The user signs in directly; credentials never pass through the language model.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { browserDir } from './codex-browser.mjs';
const url='https://id-preview--f15dee08-058b-4f62-a23e-f6b31f0a7e3e.lovable.app';
fs.mkdirSync(path.join(browserDir,'profile'),{recursive:true,mode:0o700});
const child=spawn('/usr/bin/open',['-n','-a','/Applications/Google Chrome.app','--args',
 '--user-data-dir='+path.join(browserDir,'profile'),
 '--remote-debugging-port=5182','--remote-debugging-address=127.0.0.1',
 '--no-first-run','--no-default-browser-check',url,
],{detached:true,stdio:'ignore'});
child.unref();
console.log('Opened the product test browser. Sign into Lovable here and keep this window open.');
