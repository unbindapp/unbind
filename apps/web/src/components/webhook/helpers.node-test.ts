import assert from "node:assert/strict";
import { test } from "node:test";

import { maskWebhookUrl } from "./helpers.ts";

test("provider webhook urls keep the host and the last four characters", () => {
  assert.equal(
    maskWebhookUrl(
      "https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789Xy9z",
    ),
    "https://discord.com/••••••••Xy9z",
  );
  assert.equal(
    maskWebhookUrl("https://hooks.slack.com/services/team-id/channel-id/example-secret-a1b2"),
    "https://hooks.slack.com/••••••••a1b2",
  );
  assert.equal(
    maskWebhookUrl(
      "https://api.telegram.org/bot1221212:dasdasd78dsdsa67das78/sendMessage?chat_id=156481231",
    ),
    "https://api.telegram.org/••••••••1231",
  );
});

test("a short path or query is hidden entirely", () => {
  assert.equal(
    maskWebhookUrl("https://hooks.example.com/notify?key=abc"),
    "https://hooks.example.com/••••••••",
  );
  assert.equal(maskWebhookUrl("https://hooks.example.com"), "https://hooks.example.com/••••••••");
});

test("credentials in the url are never shown", () => {
  assert.equal(
    maskWebhookUrl("https://user:pass@hooks.example.com/notify"),
    "https://hooks.example.com/••••••••",
  );
});

test("a value that is not a url is hidden entirely", () => {
  assert.equal(maskWebhookUrl("not a url"), "••••••••");
  assert.equal(maskWebhookUrl("mailto:someone@example.com"), "••••••••");
});
