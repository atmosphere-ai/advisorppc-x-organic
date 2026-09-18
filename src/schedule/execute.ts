import { READ_DM_QUERY, READ_TWEET_QUERY } from "../x/fields.js";
import { XClient, tokenFromEnv } from "../x/client.js";
import { buildTweetBody, summarizeInbox, type DmEvent } from "../x/posts.js";
import { PolicyError } from "../x/errors.js";
import { NEVER_INVENT_COPY, assertHasCopyOrMedia } from "../policy/safety.js";
import { ORGANIC_ALLOWLIST } from "./catalog.js";
import type { ExecuteResult, Job } from "./types.js";

export function organicClient(accessToken?: string): XClient {
  return new XClient({ accessToken: accessToken || tokenFromEnv() });
}

export async function executeOrganicJob(job: Job, accessToken?: string): Promise<ExecuteResult> {
  if (!ORGANIC_ALLOWLIST.has(job.action.tool)) {
    throw new PolicyError(`Refusing to run ${job.action.tool} from the scheduler. Not on the allowlist.`);
  }
  const args = job.action.arguments;
  const x = organicClient(accessToken);

  switch (job.action.tool) {
    case "x_organic_create_post": {
      const text = str(args.text);
      const media_ids = strs(args.media_ids);
      assertHasCopyOrMedia(text, media_ids);
      const body = buildTweetBody({ text, media_ids });
      const out = await x.postJson("/2/tweets", body);
      return { ok: true, detail: "posted", payload: out };
    }
    case "x_organic_reply": {
      const text = str(args.text);
      const media_ids = strs(args.media_ids);
      const in_reply_to = str(args.in_reply_to_tweet_id);
      if (!in_reply_to) throw new PolicyError("reply needs in_reply_to_tweet_id");
      assertHasCopyOrMedia(text, media_ids);
      const out = await x.postJson("/2/tweets", buildTweetBody({ text, media_ids, in_reply_to_tweet_id: in_reply_to }));
      return { ok: true, detail: "replied", payload: out };
    }
    case "x_organic_quote": {
      const text = str(args.text);
      const media_ids = strs(args.media_ids);
      const quote = str(args.quote_tweet_id);
      if (!quote) throw new PolicyError("quote needs quote_tweet_id");
      assertHasCopyOrMedia(text, media_ids);
      const out = await x.postJson("/2/tweets", buildTweetBody({ text, media_ids, quote_tweet_id: quote }));
      return { ok: true, detail: "quoted", payload: out };
    }
    case "x_organic_create_thread": {
      const posts = args.posts as { text?: string; media_ids?: string[] }[] | undefined;
      if (!Array.isArray(posts) || posts.length < 2) throw new PolicyError("thread needs posts[2+]");
      const ids: string[] = [];
      let prev: string | undefined;
      for (const p of posts) {
        assertHasCopyOrMedia(p.text, p.media_ids);
        const raw = (await x.postJson("/2/tweets", buildTweetBody({
          text: p.text,
          media_ids: p.media_ids,
          in_reply_to_tweet_id: prev,
        }))) as { data?: { id?: string } };
        const id = raw.data?.id;
        if (!id) return { ok: false, detail: `thread stopped after ${ids.length} posts`, payload: { ids } };
        ids.push(id);
        prev = id;
      }
      return { ok: true, detail: `thread ${ids.length}`, payload: { ids } };
    }
    case "x_organic_repost": {
      const me = await x.me();
      const post_id = str(args.post_id);
      if (!post_id) throw new PolicyError("repost needs post_id");
      const out = await x.postJson(`/2/users/${me.id}/retweets`, { tweet_id: post_id });
      return { ok: true, detail: "reposted", payload: out };
    }
    case "x_organic_unrepost": {
      const me = await x.me();
      const post_id = str(args.post_id);
      const out = await x.delete(`/2/users/${me.id}/retweets/${encodeURIComponent(post_id ?? "")}`);
      return { ok: true, detail: "unreposted", payload: out };
    }
    case "x_organic_delete_post": {
      const post_id = str(args.post_id);
      if (!post_id) throw new PolicyError("delete needs post_id");
      const out = await x.delete(`/2/tweets/${encodeURIComponent(post_id)}`);
      return { ok: true, detail: "deleted", payload: out };
    }
    case "x_organic_hide_reply": {
      const reply_id = str(args.reply_id);
      const hidden = args.hidden !== false;
      const out = await x.putJson(`/2/tweets/${encodeURIComponent(reply_id ?? "")}/hidden`, { hidden });
      return { ok: true, detail: hidden ? "hidden" : "unhidden", payload: out };
    }
    case "x_organic_send_dm": {
      const text = str(args.text);
      assertHasCopyOrMedia(text, strs(args.media_id ? [String(args.media_id)] : undefined));
      const payload: Record<string, unknown> = {};
      if (text) payload.text = text;
      if (args.media_id) payload.attachments = [{ media_id: String(args.media_id) }];
      if (args.dm_conversation_id) {
        const out = await x.postJson(
          `/2/dm_conversations/${encodeURIComponent(String(args.dm_conversation_id))}/messages`,
          payload,
        );
        return { ok: true, detail: "dm sent", payload: out };
      }
      const participant = str(args.participant_id);
      if (!participant) throw new PolicyError(`send_dm needs participant_id or dm_conversation_id. ${NEVER_INVENT_COPY}`);
      const out = await x.postJson(
        `/2/dm_conversations/with/${encodeURIComponent(participant)}/messages`,
        payload,
      );
      return { ok: true, detail: "dm sent", payload: out };
    }
    default:
      throw new PolicyError(`unhandled ${job.action.tool}`);
  }
}

export async function runOrganicAgent(
  agentId: string,
  _settings: Record<string, unknown>,
  accessToken?: string,
): Promise<ExecuteResult> {
  const x = organicClient(accessToken);
  if (agentId === "publish_queue") {
    return { ok: true, detail: "queue drained by worker job loop" };
  }
  if (agentId === "health") {
    const me = await x.me();
    return { ok: true, detail: `@${me.username}`, payload: { id: me.id, username: me.username } };
  }
  if (agentId === "mention_digest") {
    const me = await x.me();
    const page = await x.get(`/2/users/${encodeURIComponent(me.id)}/mentions`, {
      ...READ_TWEET_QUERY,
      max_results: 20,
    });
    return { ok: true, detail: "mentions snapshot", payload: page };
  }
  if (agentId === "inbox_digest") {
    const page = (await x.get("/2/dm_events", { ...READ_DM_QUERY, max_results: 50 })) as {
      data?: DmEvent | DmEvent[];
      includes?: unknown;
    };
    const events = page.data === undefined ? [] : Array.isArray(page.data) ? page.data : [page.data];
    const summary = summarizeInbox(events, 25);
    return { ok: true, detail: `${summary.conversation_count} conversations`, payload: { ...summary, includes: page.includes } };
  }
  return { ok: false, detail: `unknown agent ${agentId}` };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function strs(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(String).filter(Boolean);
  return out.length ? out : undefined;
}
