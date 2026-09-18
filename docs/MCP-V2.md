# MCP v2 and MCP Apps — what we targeted

Researched 2026-09-18. Same bar as [`advisorppc-x-ads`](https://github.com/atmosphere-ai/advisorppc-x-ads).

## Protocol

| Item | Value |
| --- | --- |
| Spec | [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) (latest) |
| Previous Streamable HTTP | 2025-03-26, 2025-06-18, 2025-11-25 |
| SDK | `@modelcontextprotocol/server` **v2** (replaces `@modelcontextprotocol/sdk` v1) |
| HTTP entry | `createMcpHandler(factory)` — factory runs **once per request**; returns `{ fetch }` |
| Transport | Streamable HTTP: **POST** JSON-RPC to one endpoint; optional request-scoped SSE. GET-for-SSE sessions removed (SEP-2575). stdio still first-class for local hosts. |
| Version header | `MCP-Protocol-Version` on HTTP POSTs (SEP-2243 also mirrors `Mcp-Method` / `Mcp-Name`) |

## MCP Apps

| Item | Value |
| --- | --- |
| SEP | [1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) |
| Stable spec | 2026-01-26 (`ext-apps`) |
| URI | `ui://advisorppc/x-organic/dashboard` |
| MIME | `text/html;profile=mcp-app` (declared on the resource **and** each content item) |
| Linkage | tool `_meta.ui.resourceUri` + result `_meta.ui.resourceUri` |
| CSP | empty `connectDomains` / `resourceDomains` — HTML is self-contained |

Apps is an **extension** (`io.modelcontextprotocol/ui`). Hosts that do not implement it must still work via ordinary tool `content`.
