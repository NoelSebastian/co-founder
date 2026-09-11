import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSecretKey, getPublicKey } from "nostr-tools";
export const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
export const privateDir = path.join(root, "work/backend-test");
export function envFile(name) {
	return Object.fromEntries(
		fs
			.readFileSync(path.join(privateDir, name), "utf8")
			.split("\n")
			.filter((l) => /^[A-Z_]+=/.test(l))
			.map((l) => {
				const i = l.indexOf("=");
				return [l.slice(0, i), l.slice(i + 1)];
			}),
	);
}
export const state = JSON.parse(
	fs.readFileSync(path.join(privateDir, "identities.json")),
);
export const humans = state.users.filter((u) =>
	["Noel", "Alex"].includes(u.name),
);
const identityFile = path.join(privateDir, "lovable-identity.json");
if (!fs.existsSync(identityFile)) {
	const key = generateSecretKey();
	fs.writeFileSync(
		identityFile,
		JSON.stringify({
			name: "Lovable",
			secret: Buffer.from(key).toString("hex"),
			pubkey: getPublicKey(key),
		}),
		{ mode: 0o600, flag: "wx" },
	);
}
export const builder = JSON.parse(fs.readFileSync(identityFile));
export const assistant = JSON.parse(
	fs.readFileSync(path.join(privateDir, "agent-identity.json")),
);
export const relay = "http://127.0.0.1:3030";
export const origin = "http://127.0.0.1:5180";
export const workspaceId = "e4BzmKTLLx1Tw79MYi8s";
