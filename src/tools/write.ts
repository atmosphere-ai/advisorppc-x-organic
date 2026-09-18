import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { PolicyError } from "../x/errors.js";
import { uploadMedia } from "../x/media.js";
import { buildTweetBody, linkBillingNote } from "../x/posts.js";
import {
  MEDIA_SUBSTITUTION_BAN,
  NEVER_INVENT_COPY,
  NO_SCHEDULE,
  PAY_PER_USE,
  REPLY_RESTRICTION,
  assertConfirmed,
  assertHasCopyOrMedia,
} from "../policy/safety.js";
import type { ClientFactory } from "./common.js";
import { PAY_NOTE, text, UI_META } from "./common.js";

const mediaIds = z.array(z.string()).max(4).optional();
const confirm = z
  .boolean()
  .optional()
  .describe("Must be true after the user explicitly named this action. Never set on your own.");
const replySettings = z.enum(["following", "mentionedUsers", "subscribers", "verified"]).optional();

const inlineMedia = z
  .object({
    data: z.string(),
    encoding: z.enum(["base64"]).default("base64"),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
  })
  .optional();

export function registerWriteTools(server: McpServer, getClient: ClientFactory): void {
  const x = () => getClient();

  server.registerTool(
    "x_organic_create_post",
    {
      title: "Create post",
      description:
        "POST /2/tweets. Use only the copy/media the user supplied — never invent text or handles. Requires confirm=true after an explicit named ask. " +
        PAY_PER_USE +
        " " +
        NO_SCHEDULE +
        " Up to 4 photos, 1 GIF, or 1 video via media_ids from x_organic_upload_media.",
      inputSchema: z.object({
        text: z.string().optional(),
        media_ids: mediaIds,
        reply_settings: replySettings,
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Publishing a post.");
      assertHasCopyOrMedia(args.text, args.media_ids);
      const body = buildTweetBody({
        text: args.text,
        media_ids: args.media_ids,
        reply_settings: args.reply_settings,
      });
      const result = await x().postJson("/2/tweets", body);
      return text({ ...asObj(result), billing: linkBillingNote(args.text) });
    },
  );

  server.registerTool(
    "x_organic_reply",
    {
      title: "Reply to a post",
      description:
        "POST /2/tweets as a reply (in_reply_to_tweet_id). Requires confirm=true. Do not invent copy. Do not spam-reply. " +
        REPLY_RESTRICTION +
        PAY_NOTE,
      inputSchema: z.object({
        in_reply_to_tweet_id: z.string().min(1),
        text: z.string().optional(),
        media_ids: mediaIds,
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Replying to a post.");
      assertHasCopyOrMedia(args.text, args.media_ids);
      const body = buildTweetBody({
        text: args.text,
        media_ids: args.media_ids,
        in_reply_to_tweet_id: args.in_reply_to_tweet_id,
      });
      const result = await x().postJson("/2/tweets", body);
      return text({ ...asObj(result), billing: linkBillingNote(args.text) });
    },
  );

  server.registerTool(
    "x_organic_quote",
    {
      title: "Quote a post",
      description:
        "POST /2/tweets with quote_tweet_id. Requires confirm=true. Quote-posting is Enterprise-only on self-serve/pay-per-use as of 2026-09 — expect 403 on those plans. " +
        NEVER_INVENT_COPY +
        PAY_NOTE,
      inputSchema: z.object({
        quote_tweet_id: z.string().min(1),
        text: z.string().optional(),
        media_ids: mediaIds,
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Quote-posting.");
      assertHasCopyOrMedia(args.text, args.media_ids);
      const body = buildTweetBody({
        text: args.text,
        media_ids: args.media_ids,
        quote_tweet_id: args.quote_tweet_id,
      });
      const result = await x().postJson("/2/tweets", body);
      return text({ ...asObj(result), billing: linkBillingNote(args.text) });
    },
  );

  server.registerTool(
    "x_organic_repost",
    {
      title: "Repost",
      description: "POST /2/users/:id/retweets. Requires confirm=true after the user named the post to repost.",
      inputSchema: z.object({ post_id: z.string().min(1), confirm }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id, confirm: ok }) => {
      assertConfirmed(ok, "Reposting.");
      const me = await x().me();
      return text(await x().postJson(`/2/users/${encodeURIComponent(me.id)}/retweets`, { tweet_id: post_id }));
    },
  );

  server.registerTool(
    "x_organic_unrepost",
    {
      title: "Undo repost",
      description: "DELETE /2/users/:id/retweets/:tweet_id. Requires confirm=true.",
      inputSchema: z.object({ post_id: z.string().min(1), confirm }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id, confirm: ok }) => {
      assertConfirmed(ok, "Undoing a repost.");
      const me = await x().me();
      return text(
        await x().delete(`/2/users/${encodeURIComponent(me.id)}/retweets/${encodeURIComponent(post_id)}`),
      );
    },
  );

  server.registerTool(
    "x_organic_delete_post",
    {
      title: "Delete post",
      description:
        "DELETE /2/tweets/:id. You can only delete posts you authored. Requires confirm=true after the user named the exact post. Destructive and irreversible.",
      inputSchema: z.object({ post_id: z.string().min(1), confirm }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id, confirm: ok }) => {
      assertConfirmed(ok, "Deleting a post.");
      return text(await x().delete(`/2/tweets/${encodeURIComponent(post_id)}`));
    },
  );

  server.registerTool(
    "x_organic_create_thread",
    {
      title: "Create thread",
      description:
        "Composite: publish the first post, then chain the rest as replies (in_reply_to of the previous). Use only the array of copy the user supplied — never invent posts. Requires confirm=true once for the whole thread. If a later post fails, STOP and return what already went up. " +
        PAY_PER_USE +
        " " +
        NO_SCHEDULE,
      inputSchema: z.object({
        posts: z
          .array(
            z.object({
              text: z.string().optional(),
              media_ids: mediaIds,
            }),
          )
          .min(2)
          .max(25),
        reply_settings: replySettings,
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Publishing a thread.");
      const client = x();
      const published: { index: number; id?: string; text?: string; raw: unknown }[] = [];
      let previousId: string | undefined;
      for (let i = 0; i < args.posts.length; i++) {
        const post = args.posts[i]!;
        assertHasCopyOrMedia(post.text, post.media_ids, `posts[${i}].text`);
        const body = buildTweetBody({
          text: post.text,
          media_ids: post.media_ids,
          in_reply_to_tweet_id: previousId,
          reply_settings: i === 0 ? args.reply_settings : undefined,
        });
        try {
          const raw = (await client.postJson("/2/tweets", body)) as {
            data?: { id?: string; text?: string };
          };
          const id = raw.data?.id;
          published.push({ index: i, id, text: raw.data?.text ?? post.text, raw });
          if (!id) {
            return text({
              ok: false,
              error: `Thread stopped: post ${i} did not return an id. ${MEDIA_SUBSTITUTION_BAN}`,
              published,
              billing: linkBillingNote(args.posts.map((p) => p.text ?? "").join("\n")),
            });
          }
          previousId = id;
        } catch (err) {
          return text({
            ok: false,
            error: `Thread stopped at post ${i}: ${err instanceof Error ? err.message : String(err)}`,
            published,
          });
        }
      }
      return text({
        ok: true,
        root_id: published[0]?.id,
        ids: published.map((p) => p.id),
        published,
        billing: linkBillingNote(args.posts.map((p) => p.text ?? "").join("\n")),
      });
    },
  );

  server.registerTool(
    "x_organic_hide_reply",
    {
      title: "Hide or unhide a reply",
      description:
        "PUT /2/tweets/:id/hidden. Only works for replies on a conversation you own. Requires confirm=true. Scope tweet.moderate.write. hidden=true hides, false unhides.",
      inputSchema: z.object({
        reply_id: z.string().min(1).describe("Id of the reply to hide/unhide, not the root post"),
        hidden: z.boolean().describe("true to hide, false to unhide"),
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ reply_id, hidden, confirm: ok }) => {
      assertConfirmed(ok, hidden ? "Hiding a reply." : "Unhiding a reply.");
      return text(await x().putJson(`/2/tweets/${encodeURIComponent(reply_id)}/hidden`, { hidden }));
    },
  );

  server.registerTool(
    "x_organic_like",
    {
      title: "Like a post",
      description: "POST /2/users/:id/likes. Reversible. Scope like.write. Do not mass-like.",
      inputSchema: z.object({ post_id: z.string().min(1) }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id }) => {
      const me = await x().me();
      return text(await x().postJson(`/2/users/${encodeURIComponent(me.id)}/likes`, { tweet_id: post_id }));
    },
  );

  server.registerTool(
    "x_organic_unlike",
    {
      title: "Unlike a post",
      description: "DELETE /2/users/:id/likes/:tweet_id.",
      inputSchema: z.object({ post_id: z.string().min(1) }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id }) => {
      const me = await x().me();
      return text(await x().delete(`/2/users/${encodeURIComponent(me.id)}/likes/${encodeURIComponent(post_id)}`));
    },
  );

  server.registerTool(
    "x_organic_bookmark",
    {
      title: "Bookmark a post",
      description: "POST /2/users/:id/bookmarks. Scope bookmark.write.",
      inputSchema: z.object({ post_id: z.string().min(1) }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id }) => {
      const me = await x().me();
      return text(await x().postJson(`/2/users/${encodeURIComponent(me.id)}/bookmarks`, { tweet_id: post_id }));
    },
  );

  server.registerTool(
    "x_organic_unbookmark",
    {
      title: "Remove bookmark",
      description: "DELETE /2/users/:id/bookmarks/:tweet_id.",
      inputSchema: z.object({ post_id: z.string().min(1) }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ post_id }) => {
      const me = await x().me();
      return text(
        await x().delete(`/2/users/${encodeURIComponent(me.id)}/bookmarks/${encodeURIComponent(post_id)}`),
      );
    },
  );

  server.registerTool(
    "x_organic_upload_media",
    {
      title: "Upload media",
      description:
        "Upload an image or video for an organic post (tweet_image / tweet_gif / tweet_video) or a DM (dm_*). Images use simple upload; video and files >5MB use v2 chunked INIT/APPEND/FINALIZE and poll STATUS. Never amplify_video (ads). Provide exactly one of media_url or media. " +
        MEDIA_SUBSTITUTION_BAN,
      inputSchema: z.object({
        media_url: z.string().url().optional(),
        media: inlineMedia,
        destination: z.enum(["tweet", "dm"]).optional().describe("Default tweet. Use dm for Direct Message attachments."),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ media_url, media, destination }) => {
      if (!!media_url === !!media) {
        throw new PolicyError("Provide exactly one of media_url or media.");
      }
      const client = x();
      let buf: Buffer;
      let mime = media?.mime_type;
      if (media_url) {
        const bin = await client.fetchImpl(media_url);
        if (!bin.ok) throw new PolicyError(`Failed to fetch media_url: ${bin.status}. ${MEDIA_SUBSTITUTION_BAN}`);
        buf = Buffer.from(await bin.arrayBuffer());
        mime = mime || bin.headers.get("content-type") || undefined;
      } else {
        buf = Buffer.from(media!.data, "base64");
      }
      const uploaded = await uploadMedia({
        accessToken: client.accessToken,
        body: buf,
        mimeType: mime,
        destination: destination ?? "tweet",
        fetchImpl: client.fetchImpl,
      });
      return text(uploaded);
    },
  );

  server.registerTool(
    "x_organic_reply_with_media",
    {
      title: "Reply with media",
      description:
        "Composite: upload media (if given) then reply. If upload fails, STOP — do not post a text-only substitute. Requires confirm=true. " +
        REPLY_RESTRICTION +
        PAY_NOTE,
      inputSchema: z.object({
        in_reply_to_tweet_id: z.string().min(1),
        text: z.string().optional(),
        media_ids: mediaIds,
        media_url: z.string().url().optional(),
        media: inlineMedia,
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Replying with media.");
      const client = x();
      const ids = [...(args.media_ids ?? [])];
      if (args.media_url || args.media) {
        if (!!args.media_url === !!args.media) {
          throw new PolicyError("Provide at most one of media_url or media, plus any already-uploaded media_ids.");
        }
        let buf: Buffer;
        let mime = args.media?.mime_type;
        if (args.media_url) {
          const bin = await client.fetchImpl(args.media_url);
          if (!bin.ok) throw new PolicyError(`Failed to fetch media_url: ${bin.status}. ${MEDIA_SUBSTITUTION_BAN}`);
          buf = Buffer.from(await bin.arrayBuffer());
          mime = mime || bin.headers.get("content-type") || undefined;
        } else {
          buf = Buffer.from(args.media!.data, "base64");
        }
        const uploaded = await uploadMedia({
          accessToken: client.accessToken,
          body: buf,
          mimeType: mime,
          destination: "tweet",
          fetchImpl: client.fetchImpl,
        });
        ids.push(uploaded.media_id);
      }
      assertHasCopyOrMedia(args.text, ids);
      const body = buildTweetBody({
        text: args.text,
        media_ids: ids,
        in_reply_to_tweet_id: args.in_reply_to_tweet_id,
      });
      const result = await client.postJson("/2/tweets", body);
      return text({ ...asObj(result), media_ids: ids, billing: linkBillingNote(args.text) });
    },
  );
}

function asObj(result: unknown): Record<string, unknown> {
  return result && typeof result === "object" ? (result as Record<string, unknown>) : { result };
}
