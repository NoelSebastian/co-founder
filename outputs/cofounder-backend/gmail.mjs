import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { privateDir, origin } from "./config.mjs";
import { matchesFeedback } from "./feedback-policy.mjs";
const credentialsFile = path.join(privateDir, "gmail-client.json");
const tokensFile = path.join(privateDir, "gmail-tokens.json");
const stateFile = path.join(privateDir, "gmail-monitor.json");
const callback = origin + "/gmail/callback";
const pending = new Map();
const read = (file, fallback = null) =>
	fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
function save(file, value) {
	const tmp = file + ".tmp";
	fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
	fs.renameSync(tmp, file);
}
export const feedbackConfig = () =>
	read(path.join(privateDir, "feedback-config.json"));
function credentials() {
	const j = read(credentialsFile);
	const c = j?.web || j?.installed || j;
	if (!c?.client_id || !c?.client_secret)
		throw Error("Google application credentials need to be configured first.");
	return c;
}
export function gmailStatus() {
	return {
		configured: fs.existsSync(credentialsFile),
		connected: fs.existsSync(tokensFile),
		callback,
		mailbox: feedbackConfig()?.mailbox,
		...read(stateFile, { lastChecked: null, error: null }),
	};
}
export function configureGmail(input) {
	const c = input?.web || input?.installed || input;
	if (
		typeof c?.client_id !== "string" ||
		!c.client_id.endsWith(".apps.googleusercontent.com") ||
		typeof c?.client_secret !== "string" ||
		!c.client_secret
	)
		throw Error(
			"Use the Google OAuth client JSON downloaded for this application.",
		);
	save(credentialsFile, input);
	return { ok: true };
}
export function gmailConnect() {
	const c = credentials();
	for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
	if (pending.size >= 10)
		throw Error("Finish an existing Gmail connection first.");
	const state = randomBytes(32).toString("hex"),
		verifier = randomBytes(32).toString("base64url");
	pending.set(state, { verifier, expires: Date.now() + 600000 });
	const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	u.search = new URLSearchParams({
		client_id: c.client_id,
		redirect_uri: callback,
		response_type: "code",
		scope:
			"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose",
		access_type: "offline",
		prompt: "consent",
		state,
		login_hint: feedbackConfig().mailbox,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
	}).toString();
	return { url: u.href };
}
async function tokenRequest(params) {
	const r = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params),
		signal: AbortSignal.timeout(20000),
	});
	if (!r.ok) throw Error("Google authorization failed. Reconnect Gmail.");
	return r.json();
}
export async function gmailCallback(url) {
	const state = url.searchParams.get("state"),
		p = pending.get(state);
	pending.delete(state);
	if (!p || p.expires < Date.now() || !url.searchParams.get("code"))
		throw Error(
			"Gmail connection expired or was declined. Try connecting again.",
		);
	const c = credentials();
	const t = await tokenRequest({
		client_id: c.client_id,
		client_secret: c.client_secret,
		code: url.searchParams.get("code"),
		code_verifier: p.verifier,
		redirect_uri: callback,
		grant_type: "authorization_code",
	});
	const r = await fetch(
		"https://gmail.googleapis.com/gmail/v1/users/me/profile",
		{
			headers: { Authorization: `Bearer ${t.access_token}` },
			signal: AbortSignal.timeout(20000),
		},
	);
	if (!r.ok) throw Error("Cannot verify the Gmail account");
	const profile = await r.json();
	if (
		profile.emailAddress?.toLowerCase() !==
		feedbackConfig().mailbox.toLowerCase()
	)
		throw Error("Connect the Gmail account selected for this demo.");
	if (!t.refresh_token)
		throw Error("Google did not grant offline access. Reconnect with consent.");
	save(tokensFile, { ...t, expires_at: Date.now() + t.expires_in * 1000 });
	save(stateFile, { lastChecked: null, error: null });
}
let refreshing;
async function accessToken() {
	let t = read(tokensFile);
	if (!t) throw Error("Connect Gmail in Customer feedback first.");
	if (t.expires_at > Date.now() + 60000) return t.access_token;
	refreshing ??= (async () => {
		const c = credentials();
		const n = await tokenRequest({
			client_id: c.client_id,
			client_secret: c.client_secret,
			refresh_token: t.refresh_token,
			grant_type: "refresh_token",
		});
		t = { ...t, ...n, expires_at: Date.now() + n.expires_in * 1000 };
		save(tokensFile, t);
		return t.access_token;
	})().finally(() => (refreshing = null));
	return refreshing;
}
export async function gmailRequest(endpoint, body, method = body === undefined ? "GET" : "POST") {
  if (!["GET", "POST"].includes(method) && !(method === "PUT" && /^drafts\/[A-Za-z0-9_-]+$/.test(endpoint))) throw Error("Unsupported Gmail operation");
	const r = await fetch(
		"https://gmail.googleapis.com/gmail/v1/users/me/" + endpoint,
		{
			method,
			headers: {
				Authorization: `Bearer ${await accessToken()}`,
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(30000),
		},
	);
	if (!r.ok) throw Error(`Gmail request failed (${r.status}).`);
	return r.json();
}
export function normalizeGmail(m) {
	const headers = m.payload?.headers || [];
	const header = (n) =>
		headers.find((h) => h.name.toLowerCase() === n)?.value || "";
	function text(p) {
		if (p.mimeType === "text/plain" && p.body?.data)
			return Buffer.from(p.body.data, "base64url").toString("utf8");
		return (p.parts || []).map(text).filter(Boolean).join("\n");
	}
	return {
		messageId: m.id,
		threadId: m.threadId,
		sender: header("from"),
		to: header("to").split(","),
		subject: header("subject"),
		body: text(m.payload || {}),
		labels: m.labelIds || [],
		receivedAt: Number(m.internalDate),
	};
}
export async function pollGmail(importEmail) {
	if (!fs.existsSync(tokensFile)) return;
	const cfg = feedbackConfig();
	try {
		let pageToken;
		let pages = 0;
		do {
			const q = `from:${cfg.mailbox} subject:customer after:${Math.floor(Number(cfg.createdAt))} -in:drafts -in:trash -in:spam`;
			const params = new URLSearchParams({
				q,
				maxResults: "50",
				...(pageToken ? { pageToken } : {}),
			});
			const list = await gmailRequest("messages?" + params);
			for (const { id } of list.messages || []) {
				const e = normalizeGmail(
					await gmailRequest(`messages/${encodeURIComponent(id)}?format=full`),
				);
				if (matchesFeedback(e, cfg.mailbox)) await importEmail(e);
			}
			pageToken = list.nextPageToken;
			if (++pages >= 20 && pageToken)
				throw Error(
					"More than 1,000 matching messages. Narrow the intake start date.",
				);
		} while (pageToken);
		save(stateFile, { lastChecked: new Date().toISOString(), error: null });
	} catch (e) {
		save(stateFile, { ...read(stateFile, {}), error: e.message });
		throw e;
	}
}
export async function createReplyDraft(f, existingDraftId = null) {
	const original = await gmailRequest(
		`messages/${encodeURIComponent(f.message_id)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
	);
	const h = (n) =>
		original.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value;
	const messageId = h("message-id");
	if (!messageId || /[\r\n]/.test(messageId))
		throw Error("Original email reply header is missing or invalid");
	const references = [h("references"), messageId].filter(Boolean).join(" ");
	if (/[\r\n]/.test(references)) throw Error("Invalid reply references");
	const raw = [
		`To: ${f.sender}`,
		`Subject: =?UTF-8?B?${Buffer.from("Re: " + f.subject).toString("base64")}?=`,
		`In-Reply-To: ${messageId}`,
		`References: ${references}`,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: base64",
		"",
		Buffer.from(f.reply_body).toString("base64"),
	].join("\r\n");
	return gmailRequest(existingDraftId ? `drafts/${encodeURIComponent(existingDraftId)}` : "drafts", {
		message: {
			threadId: f.email_thread_id,
			raw: Buffer.from(raw).toString("base64url"),
		},
	}, existingDraftId ? "PUT" : "POST");
}
