# Reverse-engineering notes (XMCP + X API v2)

Two official layers exist; this package is a **third**, curated operator.

| Layer | Tools | Endpoint |
| --- | --- | --- |
| Official hosted X MCP (XMCP, June 2026) | ~140–200 1:1 OpenAPI operations | `https://api.x.com/mcp` via `npx @xdevplatform/xurl mcp` |
| Docs MCP | `search_x` / `get_page_x` | `https://docs.x.com/mcp` |
| **AdvisorPPC organic** | **32** `x_organic_*` composites + confirms | this repo → `https://api.x.com/2` |

XMCP is a raw dump: it bills per call, does not compose threads, and does not enforce `confirm` or “never invent copy.” Official write coverage on the *hosted* MCP is also narrower than the REST surface (TechCrunch 2026-06-30 noted the hosted tool was not wired to Write API in the first cut; REST `POST /2/tweets` remains the source of truth).

Grok’s first-party **X Ads** connector (27 `x_ads_*` tools) is ads-only. There is no Grok first-party organic posting connector in this account; organic work belongs here.

## Object map

| Operator idea | X API v2 |
| --- | --- |
| Post | `POST /2/tweets` |
| Reply | `POST /2/tweets` + `reply.in_reply_to_tweet_id` |
| Quote | `POST /2/tweets` + `quote_tweet_id` (**Enterprise** on self-serve as of 2026-09) |
| Repost | `POST /2/users/:id/retweets` |
| Delete | `DELETE /2/tweets/:id` |
| Hide reply | `PUT /2/tweets/:id/hidden` (`tweet.moderate.write`) |
| Mentions | `GET /2/users/:id/mentions` |
| Home timeline | `GET /2/users/:id/timelines/reverse_chronological` |
| List replies | `GET /2/tweets/search/recent?query=conversation_id:{id} is:reply` |
| DMs | `GET /2/dm_events`, `POST /2/dm_conversations/with/:id/messages` |
| Media | v2 INIT/APPEND/FINALIZE + STATUS; category `tweet_*` / `dm_*` (**not** `amplify_video`) |

## Policy the official dump does not encode

- Never invent copy, handles, or media.
- `confirm=true` after an explicit named ask for post, reply, quote, repost, DM send, delete, hide.
- Media failure → STOP.
- No spam-replies, no bulk unsolicited DMs.
- 429 surfaces `Retry-After` / `x-rate-limit-reset`.
- Pay-per-use (~$0.015/post, ~$0.20/link post as of 2026) is in the tool descriptions.
- X API has **no native schedule**.

## Self-serve reply restriction (Feb 2026)

On pay-per-use / Basic / Pro, `POST /2/tweets` as a reply is rejected unless the original author @mentioned you or quoted you. Enterprise is unrestricted. Self-replies (thread chaining) are the intended way to publish a thread.

## OAuth2 PKCE

- Authorize: `https://x.com/i/oauth2/authorize`
- Token: `https://api.x.com/2/oauth2/token`
- PKCE S256. X rejects `client_secret_post`.
- Scopes: `tweet.read tweet.write users.read dm.read dm.write like.write bookmark.read bookmark.write tweet.moderate.write media.write follows.read offline.access`

## Agent playbooks

Copied into `skills/x-organic-operator/SKILL.md`.
