# Changelog

## 0.2.0 — 2026-09-18

- Built-in AdvisorPPC scheduler module (`@advisorppc/x-organic/schedule`)
- HTTP auto-starts the worker; `npm run worker` for stdio / backend
- Tools: `x_organic_scheduler_setup` / `_status` / `_settings`, `x_organic_schedule_list` / `_create` / `_cancel`, `x_organic_agents_list` / `_agent_set`
- Agents: publish_queue, mention_digest, inbox_digest, health (digests never auto-reply)
- Vendor self-setup snippets for Claude, ChatGPT, Cursor, Grok, AdvisorPPC backend
- MCP Apps scheduler view `ui://advisorppc/x-organic/scheduler`
- 40 tools total

## 0.1.0 — 2026-09-18

First user-facing release.

- 32 curated `x_organic_*` tools on X API v2 (`https://api.x.com/2`)
- Composites: `x_organic_create_thread`, `x_organic_reply_with_media`, `x_organic_inbox_summary`
- `confirm=true` on post, reply, quote, repost, DM send, delete, hide
- Chunked media upload (`tweet_image` / `tweet_gif` / `tweet_video`, never `amplify_video`)
- stdio + Streamable HTTP (`POST /mcp`)
- MCP Apps dashboard `ui://advisorppc/x-organic/dashboard`
- Skills: getting-connected, x-organic-operator, mcp-building, mcp-apps
- Claude Code plugin manifests
