import { WebClient } from "@slack/web-api";
import { db } from "../db.mjs";
import { unseal, seal, configuration, error } from "./store.mjs";
const makeWebClient = (token, options) => new WebClient(token, options);
export async function call(c, method, args = {}, makeClient = makeWebClient) {
  const lock = await db.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext($1))", [
      "slack:" + c.team + ":" + method,
    ]);
    const limited = await lock.query(
      "SELECT until_at FROM cofounder.slack_limits WHERE team=$1 AND method=$2 AND until_at>now()",
      [c.team, method],
    );
    if (limited.rowCount)
      throw error(
        "Slack is rate limiting this request. Retry after " +
          limited.rows[0].until_at.toISOString(),
        429,
      );
    // Read current authorization on every request; a disconnected connection
    // must not continue using a token retained by an in-flight UI request.
    const fresh = await lock.query(
      "SELECT secret FROM cofounder.slack_connections WHERE id=$1 AND actor=$2 AND status='connected'",
      [c.id, c.actor],
    );
    if (!fresh.rowCount) throw error("Reconnect your Slack account.", 401);
    let secret = unseal(fresh.rows[0].secret);
    if (secret.expiresAt && secret.expiresAt < Date.now() + 60000) {
      await lock.query("SELECT pg_advisory_lock(hashtext($1))", [
        "slack-refresh:" + c.id,
      ]);
      try {
        secret = unseal(
          (
            await lock.query(
              "SELECT secret FROM cofounder.slack_connections WHERE id=$1",
              [c.id],
            )
          ).rows[0].secret,
        );
        if (secret.expiresAt < Date.now() + 60000) {
          const config = await configuration();
          const refreshed = await makeClient(undefined, {
            retryConfig: { retries: 0 },
            timeout: 20000,
          }).oauth.v2.access({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: "refresh_token",
            refresh_token: secret.refreshToken,
          });
          secret = {
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            expiresAt: Date.now() + refreshed.expires_in * 1000,
          };
          await lock.query(
            "UPDATE cofounder.slack_connections SET secret=$2 WHERE id=$1",
            [c.id, seal(secret)],
          );
        }
      } finally {
        await lock.query("SELECT pg_advisory_unlock(hashtext($1))", [
          "slack-refresh:" + c.id,
        ]);
      }
    }
    try {
      return await makeClient(secret.accessToken, {
        retryConfig: { retries: 0 },
        rejectRateLimitedCalls: true,
        timeout: 20000,
      }).apiCall(method, args);
    } catch (e) {
      if (e.code === "slack_webapi_rate_limited_error") {
        await lock.query(
          "INSERT INTO cofounder.slack_limits VALUES($1,$2,now()+$3*interval '1 second') ON CONFLICT(team,method) DO UPDATE SET until_at=excluded.until_at",
          [c.team, method, Math.max(1, e.retryAfter || 60)],
        );
        throw error(
          "Slack rate limit reached. Please wait " +
            (e.retryAfter || 60) +
            " seconds.",
          429,
        );
      }
      const code = e.data?.error;
      if (
        [
          "invalid_auth",
          "token_revoked",
          "account_inactive",
          "token_expired",
        ].includes(code)
      )
        await lock.query(
          "UPDATE cofounder.slack_connections SET status='reconnect_required' WHERE id=$1",
          [c.id],
        );
      if (code) {
        const err = error(
          "Slack: " + code,
          code === "missing_scope" ? 403 : 400,
        );
        err.slackCode = code;
        err.uncertain = [
          "internal_error",
          "fatal_error",
          "request_timeout",
          "service_unavailable",
        ].includes(code);
        throw err;
      }
      const err = error(
        "Slack did not confirm the request. Check the conversation before trying again.",
        502,
      );
      err.uncertain = true;
      throw err;
    }
  } finally {
    try {
      await lock.query("SELECT pg_advisory_unlock(hashtext($1))", [
        "slack:" + c.team + ":" + method,
      ]);
    } finally {
      lock.release();
    }
  }
}
