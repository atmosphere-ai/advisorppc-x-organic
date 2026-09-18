import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "../src/server.ts";
import { DASHBOARD_URI } from "../src/apps/register.ts";
import { TOOL_COUNT } from "../src/tools/register.ts";

type ToolBag = Record<string, { enabled?: boolean; _meta?: { ui?: { resourceUri?: string } } }>;

function registeredTools(server: ReturnType<typeof createServer>): ToolBag {
  return (server as unknown as { _registeredTools: ToolBag })._registeredTools;
}

test("registers 40 operator tools plus dashboard resource", () => {
  const server = createServer({ accessToken: "test-token" });
  const tools = registeredTools(server);
  const names = Object.keys(tools);
  assert.equal(TOOL_COUNT, 40);
  assert.equal(names.length, 40);
  assert.ok(names.every((n) => n.startsWith("x_organic_")));
  assert.ok(!names.some((n) => n.startsWith("x_ads_")));
  for (const required of [
    "x_organic_get_me",
    "x_organic_create_post",
    "x_organic_create_thread",
    "x_organic_reply_with_media",
    "x_organic_inbox_summary",
    "x_organic_list_replies",
    "x_organic_send_dm",
    "x_organic_hide_reply",
    "x_organic_upload_media",
    "x_organic_mentions",
    "x_organic_scheduler_setup",
    "x_organic_schedule_create",
    "x_organic_agents_list",
    "x_organic_agent_set",
  ]) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
  assert.equal(tools.x_organic_get_me!._meta?.ui?.resourceUri, DASHBOARD_URI);
});
