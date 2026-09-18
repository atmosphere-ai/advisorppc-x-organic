---
name: mcp-building
description: Use when building or extending this MCP server, choosing SDK v1 vs v2, Streamable HTTP vs stdio, or adding tools the official XMCP dump does not curate.
version: 0.2.0
---

# Building on MCP v2 (2026-07-28)

This repo uses **SDK v2** (`@modelcontextprotocol/server`), not the v1 monolith `@modelcontextprotocol/sdk`. Same layout as `advisorppc-x-ads`.

## Why v2

- Spec **2026-07-28** is current. Streamable HTTP is POST-only JSON-RPC (SSE only as a request-scoped response stream). The old GET-for-SSE session is gone (SEP-2575).
- `registerTool(name, { description, inputSchema: zod, annotations, _meta }, handler)`.
- Return `{ content, structuredContent, _meta }`. Annotations: `readOnlyHint`, `destructiveHint`, `openWorldHint`.
- stdio: `StdioServerTransport` from `@modelcontextprotocol/server/stdio`.
- HTTP: `createMcpHandler(factory)` from `@modelcontextprotocol/server`. The factory runs **once per request**.

## Layout we use

- `src/x/client.ts` — X API v2 (Bearer JSON, pagination via `next_token`, 429)
- `src/policy/safety.ts` — `confirm` flags, no invented copy, no bulk DMs
- `src/x/media.ts` — simple image + v2 chunked video (`tweet_*` / `dm_*`, never `amplify_video`)
- `src/x/posts.ts` — tweet body + inbox grouping + billing note
- `src/tools/read.ts` / `write.ts` / `inbox.ts` / `schedule.ts`
- `src/schedule/` — portable job store + worker (export `@advisorppc/x-organic/schedule`)
- `src/apps/` — MCP Apps `ui://` resource + tool `_meta.ui.resourceUri`
- `src/index.ts` stdio · `src/http.ts` Streamable HTTP (auto-starts worker) · `src/worker.ts` standalone

## Adding a tool

1. Pick the X API v2 path from `docs/X-API-REVERSE-ENGINEERING.md`.
2. Zod input. Never invent copy; user-supplied text only.
3. Reads: `readOnlyHint: true` and `_meta.ui.resourceUri`.
4. Mutations that publish/DM/delete/hide: require `confirm=true`.
5. Tool name stays `x_organic_*`.
6. Add a test with a mocked `fetchImpl`.

## Do not

- Proxy blindly to `https://api.x.com/mcp` and drop the safety layer.
- Mix Ads API v12 / `amplify_video` into this server.
- Depend on v1 `HTTP+SSE` (`/sse` + `/messages`).
- Register tools on a shared `McpServer` outside the HTTP factory.
- Claim X has a native schedule. Use the AdvisorPPC queue module.
