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
const r = await c.listTools();
console.log(
	JSON.stringify(
		r.tools
			.filter((t) => (process.argv.includes("--all") || ["send_message", "get_message"].includes(t.name)))
			.map((t) => ({
				name: t.name,
				description: t.description?.slice(0, 170),
				inputSchema: t.inputSchema,
			})),
		null,
		2,
	),
);
await c.close();
