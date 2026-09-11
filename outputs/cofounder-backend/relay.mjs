import { finalizeEvent, verifyEvent } from "nostr-tools";
import { createHash, randomUUID } from "node:crypto";
import { relay, state, builder, humans, assistant } from "./config.mjs";
import { db } from "./db.mjs";
export function signed(who, kind, content, tags = []) {
	return finalizeEvent(
		{ kind, content, tags, created_at: Math.floor(Date.now() / 1000) },
		Buffer.from(who.secret, "hex"),
	);
}
export async function publish(event) {
	const body = JSON.stringify(event),
		url = relay + "/events";
	const signer = [builder, assistant, ...humans].find(
		(u) => u.pubkey === event.pubkey,
	);
	if (!signer) throw Error("Unknown local signer");
	const auth = signed(signer, 27235, "", [
		["u", url],
		["method", "POST"],
		["nonce", randomUUID()],
		["payload", createHash("sha256").update(body).digest("hex")],
	]);
	const r = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization:
				"Nostr " + Buffer.from(JSON.stringify(auth)).toString("base64"),
		},
		body,
		signal: AbortSignal.timeout(10000),
	});
	if (!r.ok) throw Error("Chat delivery failed");
	const j = await r.json();
	if (j.accepted === false || j.error) throw Error("Chat event rejected");
}
export async function notify(c, key, thread, content, who = builder) {
	const tags = [["h", state.room]];
	if (thread) tags.push(["e", thread, "", "reply"]);
	const event = signed(who, 9, content, tags);
	await c.query(
		"INSERT INTO cofounder.outbox(id,event) VALUES($1,$2) ON CONFLICT DO NOTHING",
		[key, event],
	);
}
export async function flushOutbox() {
	const { rows } = await db.query(
		"SELECT * FROM cofounder.outbox WHERE NOT sent LIMIT 10",
	);
	for (const r of rows) {
		await publish(r.event);
		await db.query("UPDATE cofounder.outbox SET sent=true WHERE id=$1", [r.id]);
	}
}
export function threadOf(e) {
	return (
		e.tags.find((t) => t[0] === "e" && t[3] === "root")?.[1] ||
		e.tags.find((t) => t[0] === "e")?.[1] ||
		e.id
	);
}
export async function connect() {
	const socket = new WebSocket(relay.replace("http", "ws"));
	const listeners = new Set();
	let readyResolve, readyReject;
	const ready = new Promise((r, j) => {
		readyResolve = r;
		readyReject = j;
	});
	const timeout = setTimeout(
		() => readyReject(Error("Relay authentication timed out")),
		10000,
	);
	let authId;
	socket.addEventListener("error", () =>
		readyReject(Error("Relay connection failed")),
	);
	socket.addEventListener("message", ({ data }) => {
		const m = JSON.parse(data);
		if (m[0] === "AUTH") {
			const a = signed(builder, 22242, "", [
				["relay", relay.replace("http", "ws")],
				["challenge", m[1]],
			]);
			authId = a.id;
			socket.send(JSON.stringify(["AUTH", a]));
		}
		if (m[0] === "OK" && m[1] === authId) {
			clearTimeout(timeout);
			m[2]
				? readyResolve()
				: readyReject(Error("Relay authentication rejected"));
		}
		for (const l of listeners) l(m);
	});
	await ready;
	return { socket, listeners };
}
export async function history() {
	const { socket, listeners } = await connect();
	const id = randomUUID();
	try {
		return await new Promise((resolve, reject) => {
			const items = [];
			const timer = setTimeout(
				() => reject(Error("Chat history timed out")),
				10000,
			);
			listeners.add((m) => {
				if (m[1] !== id) return;
				if (m[0] === "EVENT" && verifyEvent(m[2])) items.push(m[2]);
				if (m[0] === "EOSE") {
					clearTimeout(timer);
					resolve(
						items.sort(
							(a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id),
						),
					);
				}
				if (m[0] === "CLOSED") {
					clearTimeout(timer);
					reject(Error("Channel access denied"));
				}
			});
			socket.send(
				JSON.stringify([
					"REQ",
					id,
					{ kinds: [9], "#h": [state.room], limit: 100 },
				]),
			);
		});
	} finally {
		socket.close();
	}
}
export async function provision() {
	const alreadyJoined = (await history()).length > 0;
	await publish(
		signed(
			builder,
			0,
			JSON.stringify({
				name: "Lovable",
				display_name: "Lovable",
				bot: true,
				about: "Builds approved PRDs and returns previews to this channel.",
			}),
		),
	);
	if (alreadyJoined) return;
	await publish(
		signed(humans[0], 9000, "", [
			["h", state.room],
			["p", builder.pubkey],
		]),
	);
}
