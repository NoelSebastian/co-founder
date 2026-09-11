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
for(const path of ["src/lib/crm.ts","src/routes/_authenticated/pipeline.tsx","src/routes/_authenticated/route.tsx"]){const r=await c.callTool({name:"read_file",arguments:{project_id:"3aa831e2-c372-4898-85b1-4e72929a4682",path}});console.log(path,JSON.stringify(r));}await c.close();