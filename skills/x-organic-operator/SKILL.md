---
name: x-organic-operator
description: Use when publishing threads, triaging mentions, or answering X Direct Messages through AdvisorPPC organic tools. Contains playbooks for the 32 x_organic_* tools.
version: 0.1.0
---

# X organic operator playbooks

This is **organic** X (`api.x.com/2`), not ads. Never invent copy, handles, or media. Warn that pay-per-use is ~$0.015/post and **~$0.20 if the text contains a link**.

X API has **no native schedule**. Do not fake a queue.

## Publish a thread

1. `x_organic_get_me` so you know who you are posting as.
2. Confirm every line of copy with the user. Do not add hashtags, CTAs, or emoji they did not write.
3. If there is media: `x_organic_upload_media` (destination `tweet`). If upload fails, **STOP**.
4. `x_organic_create_thread` with `posts: [{text, media_ids?}, …]` (first is root, rest reply-chain) and `confirm=true` after they said to publish **this** thread.
5. Return the root id and the chain. If a later post fails, report what already went up — do not invent replacements.

A single post is `x_organic_create_post`, not a 1-item thread.

## Triage mentions

1. `x_organic_mentions` (or `x_organic_list_replies` on a named post).
2. Summarize who pinged you and what they asked. Do not auto-reply.
3. If the user names a reply: `x_organic_reply` with **their** copy and `confirm=true`.
4. Self-serve restriction: replies to others only work if they @mentioned you or quoted you. If X 403s, say so; do not retry as a root post unless they asked to quote/repost instead.
5. Hide a named reply on a conversation you own with `x_organic_hide_reply` (`confirm=true`).

Do not spam-reply. One named conversation at a time.

## Answer inbox

1. `x_organic_inbox_summary` — conversations + last message.
2. `x_organic_list_dm_conversation` for the thread they named.
3. Draft using only their words. `x_organic_send_dm` with `confirm=true` to one recipient (`participant_id`, `username`, or `dm_conversation_id`).
4. No bulk unsolicited DMs. No “follow-up blast.”

DM media: `x_organic_upload_media` with `destination=dm`, then pass `media_id`.

## Hard rules

- `confirm=true` for post, reply, quote, repost, DM send, delete, hide — only after an explicit named ask.
- Quote-posting is Enterprise-only on self-serve as of 2026-09; expect 403 otherwise.
- Media failure → STOP. Never substitute a still or a library leftover.
- Never mix in `x_ads_*` or Ads API v12 from this server.
