import { PolicyError } from "./errors.js";
import { containsLink } from "./hash.js";
import { NEVER_INVENT_COPY, PAY_PER_USE } from "../policy/safety.js";

export type TweetDraft = {
  text?: string;
  media_ids?: string[];
  in_reply_to_tweet_id?: string;
  quote_tweet_id?: string;
  reply_settings?: "following" | "mentionedUsers" | "subscribers" | "verified";
};

export type ThreadPost = {
  text?: string;
  media_ids?: string[];
};

export function buildTweetBody(draft: TweetDraft): Record<string, unknown> {
  const hasText = typeof draft.text === "string" && draft.text.length > 0;
  const hasMedia = Array.isArray(draft.media_ids) && draft.media_ids.length > 0;
  if (!hasText && !hasMedia) {
    throw new PolicyError(`Provide user-supplied text and/or media_ids. ${NEVER_INVENT_COPY}`);
  }
  const body: Record<string, unknown> = {};
  if (draft.text !== undefined) body.text = draft.text;
  if (hasMedia) body.media = { media_ids: draft.media_ids };
  if (draft.in_reply_to_tweet_id) {
    body.reply = { in_reply_to_tweet_id: draft.in_reply_to_tweet_id };
  }
  if (draft.quote_tweet_id) body.quote_tweet_id = draft.quote_tweet_id;
  if (draft.reply_settings) body.reply_settings = draft.reply_settings;
  return body;
}

export function linkBillingNote(text?: string): string {
  if (text && containsLink(text)) {
    return "This post contains a link. X API pay-per-use bills ~$0.20 per link post as of 2026 (plain posts ~$0.015). Warn the user before posting links.";
  }
  return PAY_PER_USE;
}

export function repliesQuery(postId: string): string {
  return `conversation_id:${postId} is:reply`;
}

export type DmEvent = {
  id?: string;
  dm_conversation_id?: string;
  text?: string;
  sender_id?: string;
  created_at?: string;
  event_type?: string;
};

export type InboxConversation = {
  dm_conversation_id: string;
  message_count_in_page: number;
  last_message: DmEvent;
};

export function summarizeInbox(events: DmEvent[], maxConversations = 25): {
  conversation_count: number;
  conversations: InboxConversation[];
} {
  const byConv = new Map<string, DmEvent[]>();
  for (const e of events) {
    const id = e.dm_conversation_id || "unknown";
    const list = byConv.get(id) ?? [];
    list.push(e);
    byConv.set(id, list);
  }
  const conversations: InboxConversation[] = [...byConv.entries()].map(([id, msgs]) => {
    const sorted = [...msgs].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return {
      dm_conversation_id: id,
      message_count_in_page: msgs.length,
      last_message: sorted[0] ?? { dm_conversation_id: id },
    };
  });
  conversations.sort((a, b) =>
    String(b.last_message.created_at ?? "").localeCompare(String(a.last_message.created_at ?? "")),
  );
  return {
    conversation_count: conversations.length,
    conversations: conversations.slice(0, maxConversations),
  };
}
