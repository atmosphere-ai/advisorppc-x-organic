import assert from "node:assert/strict";
import { test } from "node:test";
import { PolicyError } from "../src/x/errors.ts";
import {
  assertConfirmed,
  assertHasCopyOrMedia,
  assertNotBulkDm,
} from "../src/policy/safety.ts";
import { buildTweetBody, linkBillingNote, repliesQuery, summarizeInbox } from "../src/x/posts.ts";

test("write without confirm is refused", () => {
  assert.throws(() => assertConfirmed(undefined, "Publishing a post."), PolicyError);
  assert.throws(() => assertConfirmed(false, "Publishing a post."), PolicyError);
  assert.doesNotThrow(() => assertConfirmed(true, "Publishing a post."));
});

test("X_ORGANIC_ALLOW_UNCONFIRMED bypasses confirm", () => {
  const prev = process.env.X_ORGANIC_ALLOW_UNCONFIRMED;
  process.env.X_ORGANIC_ALLOW_UNCONFIRMED = "1";
  try {
    assert.doesNotThrow(() => assertConfirmed(undefined, "Publishing a post."));
  } finally {
    if (prev === undefined) delete process.env.X_ORGANIC_ALLOW_UNCONFIRMED;
    else process.env.X_ORGANIC_ALLOW_UNCONFIRMED = prev;
  }
});

test("refuses empty copy and media", () => {
  assert.throws(() => assertHasCopyOrMedia(undefined, undefined), PolicyError);
  assert.throws(() => assertHasCopyOrMedia("", []), PolicyError);
  assert.doesNotThrow(() => assertHasCopyOrMedia("hi", undefined));
  assert.doesNotThrow(() => assertHasCopyOrMedia(undefined, ["1"]));
});

test("refuses bulk DMs", () => {
  assert.throws(() => assertNotBulkDm(["1", "2"]), PolicyError);
  assert.doesNotThrow(() => assertNotBulkDm(["1"]));
});

test("buildTweetBody chains reply and media and never invents text", () => {
  assert.throws(() => buildTweetBody({}), PolicyError);
  const reply = buildTweetBody({
    text: "thanks",
    in_reply_to_tweet_id: "99",
    media_ids: ["m1"],
  });
  assert.equal(reply.text, "thanks");
  assert.deepEqual(reply.reply, { in_reply_to_tweet_id: "99" });
  assert.deepEqual(reply.media, { media_ids: ["m1"] });
});

test("link billing note flags URL posts", () => {
  assert.match(linkBillingNote("https://x.com/a"), /\$0\.20/);
  assert.match(linkBillingNote("plain"), /\$0\.015/);
});

test("repliesQuery is conversation_id + is:reply", () => {
  assert.equal(repliesQuery("123"), "conversation_id:123 is:reply");
});

test("summarizeInbox groups by conversation and keeps last message", () => {
  const out = summarizeInbox([
    { id: "1", dm_conversation_id: "c1", text: "old", created_at: "2026-01-01T00:00:00Z" },
    { id: "2", dm_conversation_id: "c1", text: "new", created_at: "2026-01-02T00:00:00Z" },
    { id: "3", dm_conversation_id: "c2", text: "other", created_at: "2026-01-03T00:00:00Z" },
  ]);
  assert.equal(out.conversation_count, 2);
  assert.equal(out.conversations[0]!.dm_conversation_id, "c2");
  assert.equal(out.conversations[1]!.last_message.text, "new");
  assert.equal(out.conversations[1]!.message_count_in_page, 2);
});
