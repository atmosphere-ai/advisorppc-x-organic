import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { READ_DM_QUERY } from "../x/fields.js";
import { normalizeHandle } from "../x/hash.js";
import { summarizeInbox, type DmEvent } from "../x/posts.js";
import { NEVER_INVENT_COPY, NO_SPAM, assertConfirmed, assertHasCopyOrMedia } from "../policy/safety.js";
import type { ClientFactory } from "./common.js";
import { dropEmpty, text, UI_META } from "./common.js";

export function registerInboxTools(server: McpServer, getClient: ClientFactory): void {
  const x = () => getClient();

  server.registerTool(
    "x_organic_list_dm_events",
    {
      title: "List DM events",
      description:
        "GET /2/dm_events (MessageCreate). One page of inbox events with sender expansion. Scope dm.read. Do not dump DMs into public posts.",
      inputSchema: z.object({
        max_results: z.number().int().min(1).max(100).optional(),
        pagination_token: z.string().optional(),
        dm_event_fields: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ max_results, pagination_token }) =>
      text(
        await x().get(
          "/2/dm_events",
          dropEmpty({ ...READ_DM_QUERY, max_results, pagination_token }),
        ),
      ),
  );

  server.registerTool(
    "x_organic_list_dm_conversation",
    {
      title: "Read a DM conversation",
      description:
        "GET /2/dm_conversations/:id/dm_events. Pass a conversation id from inbox_summary or list_dm_events. Scope dm.read.",
      inputSchema: z.object({
        dm_conversation_id: z.string().min(1),
        max_results: z.number().int().min(1).max(100).optional(),
        pagination_token: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ dm_conversation_id, max_results, pagination_token }) =>
      text(
        await x().get(
          `/2/dm_conversations/${encodeURIComponent(dm_conversation_id)}/dm_events`,
          dropEmpty({ ...READ_DM_QUERY, max_results, pagination_token }),
        ),
      ),
  );

  server.registerTool(
    "x_organic_send_dm",
    {
      title: "Send a Direct Message",
      description:
        "Send one DM to a named recipient (participant_id or username) or an existing dm_conversation_id. Requires confirm=true after an explicit named ask. Never invent copy. One recipient — no bulk unsolicited DMs. Optional media_id from x_organic_upload_media with destination=dm. " +
        NO_SPAM,
      inputSchema: z.object({
        participant_id: z.string().optional().describe("Numeric user id of the recipient"),
        username: z.string().optional().describe("Handle of the recipient if you do not have the id yet"),
        dm_conversation_id: z.string().optional(),
        text: z.string().optional(),
        media_id: z.string().optional(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Sending a Direct Message.");
      assertHasCopyOrMedia(args.text, args.media_id ? [args.media_id] : undefined);
      const sources = [args.participant_id, args.username, args.dm_conversation_id].filter(Boolean);
      if (sources.length !== 1) {
        throw new Error("Provide exactly one of participant_id, username, or dm_conversation_id.");
      }
      const client = x();
      let participant_id = args.participant_id;
      if (args.username) {
        const handle = normalizeHandle(args.username);
        const looked = (await client.get(`/2/users/by/username/${encodeURIComponent(handle)}`)) as {
          data?: { id?: string };
        };
        participant_id = looked.data?.id;
        if (!participant_id) throw new Error(`Could not resolve @${handle} to a user id. ${NEVER_INVENT_COPY}`);
      }
      const payload: Record<string, unknown> = {};
      if (args.text) payload.text = args.text;
      if (args.media_id) payload.attachments = [{ media_id: args.media_id }];
      if (args.dm_conversation_id) {
        return text(
          await client.postJson(
            `/2/dm_conversations/${encodeURIComponent(args.dm_conversation_id)}/messages`,
            payload,
          ),
        );
      }
      return text(
        await client.postJson(
          `/2/dm_conversations/with/${encodeURIComponent(participant_id!)}/messages`,
          payload,
        ),
      );
    },
  );

  server.registerTool(
    "x_organic_inbox_summary",
    {
      title: "Inbox summary",
      description:
        "Composite: fetch recent DM events and group by conversation with the last message. Use this to triage inbox, then x_organic_list_dm_conversation + x_organic_send_dm (confirm) to answer. Do not auto-reply.",
      inputSchema: z.object({
        max_results: z.number().int().min(1).max(100).optional(),
        max_conversations: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ max_results, max_conversations }) => {
      const page = (await x().get("/2/dm_events", {
        ...READ_DM_QUERY,
        max_results: max_results ?? 100,
      })) as { data?: DmEvent | DmEvent[]; includes?: unknown; meta?: unknown };
      const events = page.data === undefined ? [] : Array.isArray(page.data) ? page.data : [page.data];
      const summary = summarizeInbox(events, max_conversations ?? 25);
      return text({
        ...summary,
        includes: page.includes,
        meta: page.meta,
      });
    },
  );
}
