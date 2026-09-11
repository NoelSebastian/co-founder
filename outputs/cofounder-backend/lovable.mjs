import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
let clientPromise;
async function connect() {
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
	t.stderr?.on("data", () => {});
	await c.connect(t);
	return c;
}
export async function call(name, args) {
	clientPromise ??= connect().catch((e) => {
		clientPromise = null;
		throw e;
	});
	const c = await clientPromise;
	const r = await c.callTool({ name, arguments: args }, undefined, {
		timeout: 120000,
	});
	if (r.isError)
		throw Error(
			"Lovable rejected the request. Check its connection and credits.",
		);
	if (r.structuredContent) return r.structuredContent;
	const text = r.content
		?.filter((x) => x.type === "text")
		.map((x) => x.text)
		.join("\n");
	try {
		return JSON.parse(text);
	} catch {
		throw Error("Lovable returned an unexpected response");
	}
}
export function field(o, names) {
	if (!o || typeof o !== "object") return null;
	for (const k of names) if (typeof o[k] === "string" && o[k]) return o[k];
	for (const [k, v] of Object.entries(o)) {
		if (["thinking", "content", "text"].includes(k)) continue;
		if (v && typeof v === "object") {
			const r = field(v, names);
			if (r) return r;
		}
	}
	return null;
}
export function buildStatus(o) {
	const nested = o?.response?.status || o?.agent_response?.status;
	if (nested) return nested;
	return field(o, ["status"]);
}
