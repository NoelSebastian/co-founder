import test from "node:test";
import assert from "node:assert/strict";
import {
  isLovableUser,
  LOVABLE_SLACK_APP_ID,
  safeAppLink,
} from "./lovableIntegration.ts";
test("Lovable discovery binds official app identity, never a display-name impersonator", () => {
  const user = {
    id: "U1",
    name: "lovable",
    is_bot: true,
    profile: { api_app_id: LOVABLE_SLACK_APP_ID },
  };
  assert.equal(isLovableUser(user), true);
  assert.equal(isLovableUser({ ...user, deleted: true }), false);
  assert.equal(isLovableUser({ ...user, is_bot: false }), false);
  assert.equal(
    isLovableUser({ ...user, profile: { api_app_id: "OTHER" } }),
    false,
  );
});
test("app buttons reject executable, credential-bearing and non-web URLs", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:password@example.com",
    "file:///tmp/x",
    undefined,
  ])
    assert.equal(safeAppLink(value), null);
  assert.equal(
    safeAppLink("https://lovable.dev/settings/slack"),
    "https://lovable.dev/settings/slack",
  );
});
