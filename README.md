# AdvisorPPC X Organic

**Policy-safe organic X (Twitter) for MCP clients** — Claude Code, Cursor, Grok, VS Code, or any Streamable HTTP host.

This is the posting / community-management connector. Ads live in [`atmosphere-ai/advisorppc-x-ads`](https://github.com/atmosphere-ai/advisorppc-x-ads). Official XMCP at `https://api.x.com/mcp` is a 140–200 endpoint dump that bills per call; this package is a **curated operator set** (composites, confirm flags, skills).

[Website](https://advisorppc.com) · [Tasks](TASKS.md) · [Reverse-engineering](docs/X-API-REVERSE-ENGINEERING.md) · [MCP v2 notes](docs/MCP-V2.md)

## What you get

| Layer | Detail |
| --- | --- |
| Protocol | MCP **2026-07-28** (SDK v2 `@modelcontextprotocol/server`) |
| Transports | **stdio** (local) and **Streamable HTTP** `POST /mcp` |
| UI | **MCP Apps** dashboard `ui://advisorppc/x-organic/dashboard` (hosts without Apps still get JSON) |
| API | `https://api.x.com/2` with OAuth2 user-context Bearer |
| Safety | Never invent copy; `confirm=true` on live-fire; media failure stops; no bulk DMs |

## Tools (32)

**Read:** `x_organic_get_me` · `x_organic_lookup_user` · `x_organic_lookup_users` · `x_organic_search_users` · `x_organic_get_post` · `x_organic_lookup_posts` · `x_organic_user_posts` · `x_organic_my_timeline` · `x_organic_mentions` · `x_organic_search_recent` · `x_organic_list_replies` · `x_organic_get_quote_tweets` · `x_organic_liked_posts` · `x_organic_list_bookmarks`

**Write posts:** `x_organic_create_post` · `x_organic_reply` · `x_organic_quote` · `x_organic_repost` · `x_organic_unrepost` · `x_organic_delete_post` · `x_organic_create_thread` · `x_organic_hide_reply`

**Share:** `x_organic_like` · `x_organic_unlike` · `x_organic_bookmark` · `x_organic_unbookmark`

**Media:** `x_organic_upload_media` (images + chunked `tweet_video` / `dm_video`, never `amplify_video`) · `x_organic_reply_with_media`

**Inbox:** `x_organic_list_dm_events` · `x_organic_list_dm_conversation` · `x_organic_send_dm` · `x_organic_inbox_summary`

## Install

```bash
git clone https://github.com/atmosphere-ai/advisorppc-x-organic
cd advisorppc-x-organic
npm install
cp .env.example .env   # set X_ACCESS_TOKEN
npm run build
```

Token: an X developer app with **user-context** OAuth 2.0 PKCE. Scopes:

```
tweet.read tweet.write users.read
dm.read dm.write
like.write bookmark.read bookmark.write
tweet.moderate.write media.write
follows.read offline.access
```

Auth URL `https://x.com/i/oauth2/authorize`, token URL `https://api.x.com/2/oauth2/token`. PKCE S256; X rejects `client_secret_post`. Always include `offline.access` or the token dies in ~2 hours.

### Claude Code / Cursor (stdio)

```json
{
  "mcpServers": {
    "advisorppc-x-organic": {
      "command": "node",
      "args": ["/absolute/path/to/advisorppc-x-organic/dist/index.js"],
      "env": { "X_ACCESS_TOKEN": "…" }
    }
  }
}
```

Or the plugin path: `claude plugin marketplace add atmosphere-ai/advisorppc-x-organic` then install `advisorppc-x-organic@advisorppc`.

### Streamable HTTP

```bash
npm run start:http
# POST http://127.0.0.1:3333/mcp
# Authorization: Bearer <token>  (overrides env)
```

Grok web custom connector: server URL of your hosted `/mcp`, PKCE, scopes as above.

### Grok Build CLI

```toml
[mcp_servers.advisorppc-x-organic]
command = "node"
args = ["/absolute/path/to/dist/index.js"]

[mcp_servers.advisorppc-x-organic.env]
X_ACCESS_TOKEN = "…"
```

## Safety

| Action | Default | To override |
| --- | --- | --- |
| Post / reply / quote / thread / repost | refused | `confirm=true` after the user named the copy |
| DM send | refused | `confirm=true` to **one** named recipient |
| Delete / hide | refused | `confirm=true` after the user named the post/reply |
| Failed media | **stop** | never attach a substitute |
| Invented copy, handle, or media | forbidden | user supplies it |
| Schedule | not supported | X API has no native schedule |

**Pay-per-use (as of 2026):** ~$0.015 per plain post, **~$0.20 if the text contains a link**. Tool descriptions tell the model to warn before posting links.

**Self-serve replies:** on pay-per-use / Basic / Pro, replies to someone else only succeed if they @mentioned you or quoted you. Threading your own posts is the intended `create_thread` path. Quote-posting is Enterprise-only on those plans.

## Skills (bundled)

| Skill | When to use |
| --- | --- |
| `getting-connected` | Auth, tokens, first `get_me` |
| `x-organic-operator` | Playbooks (publish thread, triage mentions, answer inbox) |
| `mcp-building` | How this server is built on MCP v2 |
| `mcp-apps` | Inline dashboard / `ui://` resources |

## Develop

```bash
npm test
npm run typecheck
npm run dev          # stdio
npm run dev:http
```

## What this is not

- Not Ads, pixels, audiences, or campaigns — that is [`atmosphere-ai/advisorppc-x-ads`](https://github.com/atmosphere-ai/advisorppc-x-ads).
- Not a 1:1 clone of X’s official XMCP at `https://api.x.com/mcp`.
- Not a scheduler. X API cannot natively schedule posts.
- Not a Google Ads connector — that is [`advisorppc-org/advisorppc-plugin`](https://github.com/advisorppc-org/advisorppc-plugin) → `https://mcp.advisorppc.com/claude`.

## License

MIT for this repository. The AdvisorPPC name and hosted service remain Advisor Media.
