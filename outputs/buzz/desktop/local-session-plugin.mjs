import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Only installed by Vite's live-test mode. Never part of a built application.
export function localSessionPlugin() {
  return {
    name: "cofounder-local-test-session",
    configResolved(config) {
      if (config.command === "build")
        throw new Error(
          "live-test is a local development mode and cannot be built for deployment",
        );
    },
    configureServer(server) {
      server.middlewares.use("/__cofounder-test/session", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        const host = req.headers.host;
        if (
          !/^127\.0\.0\.1:(5174|5175)$/.test(host ?? "") ||
          req.headers.origin !== `http://${host}` ||
          req.method !== "POST"
        ) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Local test access only" }));
          return;
        }
        try {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 128) throw new Error("Request too large");
          }
          const { user } = JSON.parse(body);
          if (user !== "Noel" && user !== "Alex")
            throw new Error("Unknown test user");
          const file = fileURLToPath(
            new URL(
              "../../../work/backend-test/identities.json",
              import.meta.url,
            ),
          );
          const state = JSON.parse(await readFile(file, "utf8"));
          const identity = state.users.find((u) => u.name === user);
          res.end(
            JSON.stringify({
              identity: {
                username: identity.name,
                pubkey: identity.pubkey,
                privateKey: identity.secret,
              },
              room: state.room,
            }),
          );
        } catch {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error:
                "Local test session unavailable. Run the backend smoke test first.",
            }),
          );
        }
      });
    },
  };
}
