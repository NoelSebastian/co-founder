import test from "node:test";
import assert from "node:assert/strict";
import { localSessionPlugin } from "./local-session-plugin.mjs";

test("local test identity endpoint rejects requests outside same-origin local POST", async () => {
  let handler;
  localSessionPlugin().configureServer({
    middlewares: {
      use(_path, h) {
        handler = h;
      },
    },
  });
  for (const headers of [
    { host: "evil.example:5174", origin: "http://evil.example:5174" },
    { host: "127.0.0.1:5174", origin: "https://evil.example" },
    { host: "127.0.0.1:5174" },
    { host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173" },
  ]) {
    const response = {
      setHeader() {},
      end(body) {
        this.body = body;
      },
    };
    await handler({ headers, method: "POST" }, response);
    assert.equal(response.statusCode, 403);
    assert(!response.body.includes("privateKey"));
  }
  const response = { setHeader() {}, end() {} };
  await handler(
    {
      headers: { host: "127.0.0.1:5174", origin: "http://127.0.0.1:5174" },
      method: "GET",
    },
    response,
  );
  assert.equal(response.statusCode, 403);
});

test("test identity mode cannot be built for deployment", () => {
  assert.throws(
    () => localSessionPlugin().configResolved({ command: "build" }),
    /cannot be built/,
  );
  assert.doesNotThrow(() =>
    localSessionPlugin().configResolved({ command: "serve" }),
  );
});
