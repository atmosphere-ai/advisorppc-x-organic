/** Default v2 field sets so reads are operator-useful without dumping the whole OpenAPI. */

export const TWEET_FIELDS = [
  "created_at",
  "public_metrics",
  "author_id",
  "conversation_id",
  "in_reply_to_user_id",
  "referenced_tweets",
  "attachments",
  "entities",
  "possibly_sensitive",
  "lang",
  "reply_settings",
  "note_tweet",
].join(",");

export const USER_FIELDS = [
  "created_at",
  "description",
  "location",
  "name",
  "username",
  "public_metrics",
  "verified",
  "verified_type",
  "profile_image_url",
  "protected",
  "url",
].join(",");

export const MEDIA_FIELDS = [
  "media_key",
  "type",
  "url",
  "preview_image_url",
  "duration_ms",
  "public_metrics",
  "alt_text",
  "width",
  "height",
].join(",");

export const TWEET_EXPANSIONS = [
  "author_id",
  "attachments.media_keys",
  "referenced_tweets.id",
  "in_reply_to_user_id",
  "entities.mentions.username",
].join(",");

export const DM_EVENT_FIELDS = [
  "id",
  "event_type",
  "text",
  "sender_id",
  "dm_conversation_id",
  "created_at",
  "attachments",
  "referenced_tweets",
].join(",");

export const DM_EXPANSIONS = [
  "sender_id",
  "participant_ids",
  "attachments.media_keys",
  "referenced_tweets.id",
].join(",");

export const READ_TWEET_QUERY = {
  "tweet.fields": TWEET_FIELDS,
  "user.fields": USER_FIELDS,
  "media.fields": MEDIA_FIELDS,
  expansions: TWEET_EXPANSIONS,
};

export const READ_USER_QUERY = {
  "user.fields": USER_FIELDS,
};

export const READ_DM_QUERY = {
  "dm.event.fields": DM_EVENT_FIELDS,
  "user.fields": USER_FIELDS,
  "media.fields": MEDIA_FIELDS,
  expansions: DM_EXPANSIONS,
  event_types: "MessageCreate",
};
