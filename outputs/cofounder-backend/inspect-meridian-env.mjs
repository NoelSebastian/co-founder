import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const c = new Client({ name: "cofounder-local", version: "0.1.0" });
const t = new StdioClientTransport({
	command: "npx",
	args: [
		"--yes",
		"mcp-remote@0.8.5",
		"https://mcp.lovable.dev",
		"--transport",
		"http-only",
	],
	stderr: "pipe",
});
await c.connect(t);
for(const path of [".env"]){const r=await c.callTool({name:"read_file",arguments:{project_id:"3aa831e2-c372-4898-85b1-4e72929a4682",path}});(await import('node:fs')).writeFileSync('../../work/backend-test/'+path.split('/').at(-1)+'.inspection.json',JSON.stringify(r),{mode:0o600});}await c.close();process.exit(0);