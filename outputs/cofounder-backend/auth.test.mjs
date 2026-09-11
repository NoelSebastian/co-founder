import test from "node:test";
import assert from "node:assert/strict";
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";
import { createHash } from "node:crypto";
import { verifyRequest } from "./auth.mjs";
import { buildStatus } from "./lovable.mjs";
const secret = generateSecretKey(),
	pub = getPublicKey(secret),
	url = "http://127.0.0.1:5180/build",
	body = '{"id":"example"}';
function request() {
	const e = finalizeEvent(
		{
			kind: 27235,
			created_at: Math.floor(Date.now() / 1000),
			content: "",
			tags: [
				["u", url],
				["method", "POST"],
				["nonce", "unique"],
				["payload", createHash("sha256").update(body).digest("hex")],
			],
		},
		secret,
	);
	return {
		authorization: "Nostr " + Buffer.from(JSON.stringify(e)).toString("base64"),
		url,
		method: "POST",
		body,
		allowed: [pub],
	};
}
test("signed request binds actor, endpoint, method, body and expiry", () => {
	assert.equal(verifyRequest(request()).pubkey, pub);
	for (const change of [
		{ allowed: [] },
		{ url: url + "/other" },
		{ method: "GET" },
		{ body: "changed" },
		{ now: Date.now() + 120000 },
		{ authorization: "garbage" },
	])
		assert.throws(() => verifyRequest({ ...request(), ...change }));
});
test("nested Lovable response status wins over stale top-level status", () => {
	assert.equal(
		buildStatus({ status: "running", response: { status: "completed" } }),
		"completed",
	);
});
