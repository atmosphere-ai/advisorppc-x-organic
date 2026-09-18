import type { AgentDef } from "./types.js";

export const ORGANIC_PREFIX = "x_organic";

/** Tools the worker is allowed to fire. Digests are agents, not raw tools. */
export const ORGANIC_ALLOWLIST = new Set([
  "x_organic_create_post",
  "x_organic_create_thread",
  "x_organic_reply",
  "x_organic_quote",
  "x_organic_repost",
  "x_organic_unrepost",
  "x_organic_delete_post",
  "x_organic_hide_reply",
  "x_organic_send_dm",
]);

export const ORGANIC_AGENTS: AgentDef[] = [
  {
    id: "publish_queue",
    title: "Publish queue",
    description:
      "Fires due x_organic_schedule_create jobs (posts/threads/replies). Copy must already be on the job — the agent never invents text. Enable to process the queue on this process.",
    default_every_ms: 15_000,
    min_every_ms: 15_000,
    live: false,
  },
  {
    id: "mention_digest",
    title: "Mention digest",
    description:
      "Polls mentions on an interval and stores a snapshot. Optional webhook for Claude/ChatGPT/AdvisorPPC. NEVER auto-replies.",
    default_every_ms: 15 * 60_000,
    min_every_ms: 5 * 60_000,
    live: false,
    digest: true,
  },
  {
    id: "inbox_digest",
    title: "Inbox digest",
    description:
      "Polls DM events, groups conversations, stores last messages. Optional webhook. NEVER sends DMs.",
    default_every_ms: 15 * 60_000,
    min_every_ms: 5 * 60_000,
    live: false,
    digest: true,
  },
  {
    id: "health",
    title: "Token health",
    description: "Calls GET /2/users/me so a dead token shows up in scheduler status before a publish fires.",
    default_every_ms: 60 * 60_000,
    min_every_ms: 15 * 60_000,
    live: false,
    digest: true,
  },
];
