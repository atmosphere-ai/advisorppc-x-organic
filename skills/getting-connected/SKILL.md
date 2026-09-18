---
name: getting-connected
description: Use when the user asks how to connect AdvisorPPC organic X, set X_ACCESS_TOKEN, OAuth scopes, or first-run setup for this MCP server.
version: 0.1.0
---

# Getting connected to AdvisorPPC X Organic

## First run

1. Build this repo (`npm install && npm run build`).
2. Put a **user-context** OAuth2 token in `X_ACCESS_TOKEN`.
3. Register the stdio server in the MCP host (see README).
4. Call `x_organic_get_me`. A `data.id` + `username` means the token works.

A 401 is a bad/expired token, not an MCP outage. Include `offline.access` or the token dies in ~2 hours.

## OAuth 2.0 PKCE

- Authorize: `https://x.com/i/oauth2/authorize`
- Token: `https://api.x.com/2/oauth2/token`
- PKCE S256. X rejects `client_secret_post`.

Required scopes:

```
tweet.read tweet.write users.read
dm.read dm.write
like.write bookmark.read bookmark.write
tweet.moderate.write media.write
follows.read offline.access
```

HTTP mode: `Authorization: Bearer` on `POST /mcp` overrides env.

## Never

- Paste client secrets or access tokens into chat.
- Invent a handle. Always `x_organic_lookup_user` / `x_organic_get_me`.
- Treat a 401 on opening `/mcp` in a browser as downtime — it is an MCP endpoint, not a web page.
- Point this server at Ads API v12. Ads is `advisorppc-x-ads`.
