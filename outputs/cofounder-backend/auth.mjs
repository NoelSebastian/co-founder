import { verifyEvent } from "nostr-tools";
import { createHash } from "node:crypto";
export function verifyRequest({
	authorization,
	url,
	method,
	body,
	allowed,
	now = Date.now(),
}) {
	try {
		if (!authorization?.startsWith("Nostr ") || authorization.length > 6000)
			throw Error();
		const event = JSON.parse(
			Buffer.from(authorization.slice(6), "base64").toString(),
		);
		const tag = (n) => {
			const matches = event.tags.filter((t) => t[0] === n);
			return matches.length === 1 ? matches[0][1] : null;
		};
		if (
			!verifyEvent(event) ||
			event.kind !== 27235 ||
			Math.abs(now / 1000 - event.created_at) > 60 ||
			!allowed.includes(event.pubkey) ||
			tag("u") !== url ||
			tag("method") !== method ||
			!tag("nonce")
		)
			throw Error();
		if (
			body &&
			tag("payload") !== createHash("sha256").update(body).digest("hex")
		)
			throw Error();
		return event;
	} catch {
		throw Object.assign(Error("Sign in to a permitted local test account."), {
			status: 401,
		});
	}
}
