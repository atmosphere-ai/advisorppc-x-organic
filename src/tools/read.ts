import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { READ_TWEET_QUERY, READ_USER_QUERY } from "../x/fields.js";
import { normalizeHandle } from "../x/hash.js";
import { repliesQuery } from "../x/posts.js";
import type { ClientFactory } from "./common.js";
import { dropEmpty, text, UI_META } from "./common.js";

const maxResults = z.number().int().min(5).max(100).optional();
const pagination = z.string().optional().describe("pagination_token from a previous meta.next_token");

export function registerReadTools(server: McpServer, getClient: ClientFactory): void {
  const x = () => getClient();

  server.registerTool(
    "x_organic_get_me",
    {
      title: "Get authenticated user",
      description:
        "GET /2/users/me — the user on this OAuth2 token. Call first when you need user id for timeline, likes, bookmarks, or mentions. Never invent a handle.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async () => text({ data: await x().me() }),
  );

  server.registerTool(
    "x_organic_lookup_user",
    {
      title: "Lookup one user",
      description:
        "Look up a user by username (without inventing @handles) or by numeric id. Uses GET /2/users/by/username/:username or GET /2/users/:id.",
      inputSchema: z.object({
        username: z.string().optional().describe("Handle without a leading @, supplied by the user"),
        user_id: z.string().optional().describe("Numeric user id"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ username, user_id }) => {
      if (!!username === !!user_id) {
        throw new Error("Provide exactly one of username or user_id — the value the user named.");
      }
      if (username) {
        const handle = normalizeHandle(username);
        return text(await x().get(`/2/users/by/username/${encodeURIComponent(handle)}`, READ_USER_QUERY));
      }
      return text(await x().get(`/2/users/${encodeURIComponent(user_id!)}`, READ_USER_QUERY));
    },
  );

  server.registerTool(
    "x_organic_lookup_users",
    {
      title: "Lookup users",
      description: "Batch lookup. Pass usernames XOR ids (comma-separated v2). Never invent handles.",
      inputSchema: z.object({
        usernames: z.array(z.string()).min(1).max(100).optional(),
        user_ids: z.array(z.string()).min(1).max(100).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ usernames, user_ids }) => {
      if (!!usernames === !!user_ids) {
        throw new Error("Provide exactly one of usernames or user_ids.");
      }
      if (usernames) {
        return text(
          await x().get("/2/users/by", {
            ...READ_USER_QUERY,
            usernames: usernames.map(normalizeHandle).join(","),
          }),
        );
      }
      return text(await x().get("/2/users", { ...READ_USER_QUERY, ids: user_ids!.join(",") }));
    },
  );

  server.registerTool(
    "x_organic_search_users",
    {
      title: "Search users",
      description: "GET /2/users/search. Query must be what the user asked to find — do not invent people to follow.",
      inputSchema: z.object({
        query: z.string().min(1),
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ query, max_results, pagination_token }) =>
      text(await x().get("/2/users/search", dropEmpty({ query, max_results, pagination_token, ...READ_USER_QUERY }))),
  );

  server.registerTool(
    "x_organic_get_post",
    {
      title: "Get one post",
      description: "GET /2/tweets/:id with public metrics, author, media, and referenced posts.",
      inputSchema: z.object({ post_id: z.string().min(1) }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id }) => text(await x().get(`/2/tweets/${encodeURIComponent(post_id)}`, READ_TWEET_QUERY)),
  );

  server.registerTool(
    "x_organic_lookup_posts",
    {
      title: "Lookup posts",
      description: "GET /2/tweets?ids=… up to 100 ids the user named.",
      inputSchema: z.object({ post_ids: z.array(z.string()).min(1).max(100) }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_ids }) => text(await x().get("/2/tweets", { ...READ_TWEET_QUERY, ids: post_ids.join(",") })),
  );

  server.registerTool(
    "x_organic_user_posts",
    {
      title: "User post timeline",
      description: "GET /2/users/:id/tweets. Pass user_id from lookup/me. exclude=replies,retweets optional.",
      inputSchema: z.object({
        user_id: z.string().optional().describe("Defaults to the authenticated user"),
        max_results: maxResults,
        pagination_token: pagination,
        exclude: z.string().optional().describe("Comma list: replies,retweets"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ user_id, max_results, pagination_token, exclude }) => {
      const id = user_id || (await x().me()).id;
      return text(
        await x().get(
          `/2/users/${encodeURIComponent(id)}/tweets`,
          dropEmpty({ ...READ_TWEET_QUERY, max_results, pagination_token, exclude }),
        ),
      );
    },
  );

  server.registerTool(
    "x_organic_my_timeline",
    {
      title: "Home timeline",
      description:
        "GET /2/users/:id/timelines/reverse_chronological for the authenticated user (home feed). Billed per read.",
      inputSchema: z.object({
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ max_results, pagination_token }) => {
      const me = await x().me();
      return text(
        await x().get(
          `/2/users/${encodeURIComponent(me.id)}/timelines/reverse_chronological`,
          dropEmpty({ ...READ_TWEET_QUERY, max_results, pagination_token }),
        ),
      );
    },
  );

  server.registerTool(
    "x_organic_mentions",
    {
      title: "Mentions",
      description: "GET /2/users/:id/mentions for the authenticated user (or a named user_id you manage).",
      inputSchema: z.object({
        user_id: z.string().optional(),
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ user_id, max_results, pagination_token }) => {
      const id = user_id || (await x().me()).id;
      return text(
        await x().get(
          `/2/users/${encodeURIComponent(id)}/mentions`,
          dropEmpty({ ...READ_TWEET_QUERY, max_results, pagination_token }),
        ),
      );
    },
  );

  server.registerTool(
    "x_organic_search_recent",
    {
      title: "Recent search",
      description:
        "GET /2/tweets/search/recent (last 7 days). Query must be the user's. Billed per matching post. Do not run unbounded brand-watch loops.",
      inputSchema: z.object({
        query: z.string().min(1),
        max_results: maxResults,
        pagination_token: pagination,
        since_id: z.string().optional(),
        until_id: z.string().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) =>
      text(
        await x().get(
          "/2/tweets/search/recent",
          dropEmpty({
            ...READ_TWEET_QUERY,
            query: args.query,
            max_results: args.max_results,
            pagination_token: args.pagination_token,
            since_id: args.since_id,
            until_id: args.until_id,
            start_time: args.start_time,
            end_time: args.end_time,
          }),
        ),
      ),
  );

  server.registerTool(
    "x_organic_list_replies",
    {
      title: "List replies to a post",
      description:
        "Recent-search composite: conversation_id:{post_id} is:reply. Use this to triage comments. Billed per matching post. Then reply with x_organic_reply (confirm required; self-serve only if they summoned you).",
      inputSchema: z.object({
        post_id: z.string().min(1),
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id, max_results, pagination_token }) =>
      text(
        await x().get(
          "/2/tweets/search/recent",
          dropEmpty({
            ...READ_TWEET_QUERY,
            query: repliesQuery(post_id),
            max_results,
            pagination_token,
          }),
        ),
      ),
  );

  server.registerTool(
    "x_organic_get_quote_tweets",
    {
      title: "Quote tweets of a post",
      description: "GET /2/tweets/:id/quote_tweets. Quote *creation* on self-serve is Enterprise-only; reading quotes is not.",
      inputSchema: z.object({
        post_id: z.string().min(1),
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id, max_results, pagination_token }) =>
      text(
        await x().get(
          `/2/tweets/${encodeURIComponent(post_id)}/quote_tweets`,
          dropEmpty({ ...READ_TWEET_QUERY, max_results, pagination_token }),
        ),
      ),
  );

  server.registerTool(
    "x_organic_liked_posts",
    {
      title: "Liked posts",
      description: "GET /2/users/:id/liked_tweets. Defaults to the authenticated user.",
      inputSchema: z.object({
        user_id: z.string().optional(),
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ user_id, max_results, pagination_token }) => {
      const id = user_id || (await x().me()).id;
      return text(
        await x().get(
          `/2/users/${encodeURIComponent(id)}/liked_tweets`,
          dropEmpty({ ...READ_TWEET_QUERY, max_results, pagination_token }),
        ),
      );
    },
  );

  server.registerTool(
    "x_organic_list_bookmarks",
    {
      title: "List bookmarks",
      description: "GET /2/users/:id/bookmarks for the authenticated user. Scope bookmark.read.",
      inputSchema: z.object({
        max_results: maxResults,
        pagination_token: pagination,
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ max_results, pagination_token }) => {
      const me = await x().me();
      return text(
        await x().get(
          `/2/users/${encodeURIComponent(me.id)}/bookmarks`,
          dropEmpty({ ...READ_TWEET_QUERY, max_results, pagination_token }),
        ),
      );
    },
  );
}
