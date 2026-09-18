# Launch checklist — `advisorppc-x-organic`

Do **not** call this ready for users until every box in **Ready for users** is checked.

## 1. Product contract

- [x] Reverse-engineer official XMCP (`https://api.x.com/mcp`, June 2026) vs X API v2 REST
- [x] Choose MCP **2026-07-28 / SDK v2** + **MCP Apps** (SEP-1865 / ext-apps 2.x)
- [x] Create public GitHub repo `atmosphere-ai/advisorppc-x-organic`
- [x] Map curated operator names (`x_organic_*`) onto X API v2 — not a 1:1 dump

## 2. Runtime

- [x] X API v2 client (Bearer JSON, `next_token` pagination, 429 with Retry-After)
- [x] Safety policy (confirm on post/reply/quote/repost/DM/delete/hide, no invented copy, no bulk DMs)
- [x] Register operator tools (32 in 0.1.0)
- [x] Composite `x_organic_create_thread` / `x_organic_reply_with_media` / `x_organic_inbox_summary`
- [x] Chunked media upload (v2 INIT/APPEND/FINALIZE + STATUS, `tweet_*` / `dm_*`, never `amplify_video`)
- [x] stdio transport (Claude Code / Cursor / Grok Build)
- [x] Streamable HTTP transport (`POST /mcp`)
- [x] MCP App dashboard (`ui://advisorppc/x-organic/dashboard`)
- [x] Handle SHA-256 fingerprint + link billing note

## 3. Skills & packaging

- [x] `getting-connected` skill
- [x] `x-organic-operator` skill (publish thread, triage mentions, answer inbox)
- [x] `mcp-building` skill
- [x] `mcp-apps` skill
- [x] Claude Code plugin + `.mcp.json`
- [x] README, SECURITY, SUPPORT, CHANGELOG, LICENSE
- [x] Reverse-engineering + MCP v2 docs

## 4. Quality

- [x] Unit tests for client, hashing, safety confirms, media chunking, tool count
- [x] `npm test` passes (22)
- [x] `npm run typecheck` passes
- [x] Smoke: registered tools = 32, all `x_organic_*`
- [x] Pushed to GitHub `main`
- [x] Tag `v0.1.0`

## Ready for users

- [x] Install docs work for Claude Code, Cursor, Grok, and raw HTTP
- [x] Writes cannot publish unless the user explicitly confirmed (`confirm=true`)
- [x] No secrets in the repo
- [x] Version `0.1.0` tagged in CHANGELOG
- [x] CI green on `main`

### Known 0.1.0 limits

- Quote-posting is Enterprise-only on self-serve/pay-per-use (tool still exists; expect 403).
- Self-serve replies to others require a summon (@mention or quote of you).
- No native schedule (X API cannot).
- Follow/unfollow, lists, Spaces, Articles, Community Notes are out of the curated set — use official XMCP if you need the dump.
- Org `advisorppc-org` could not host this repo (no create-repo permission); lives under `atmosphere-ai` until transferred.
