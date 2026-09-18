import { PolicyError } from "../x/errors.js";

export const MEDIA_SUBSTITUTION_BAN =
  "If the intended media failed to upload or process, STOP. Do not substitute a still, a source image, or a pre-existing library asset.";

export const NO_SPAM =
  "Do not spam-reply and do not send bulk unsolicited DMs. One named conversation at a time.";

export const NO_SCHEDULE =
  "X API has no native schedule. Use AdvisorPPC x_organic_schedule_* tools — never invent a publish time outside the job store.";

export const NEVER_INVENT_COPY =
  "Never invent post text, DM copy, handles, or media. Use only what the user supplied.";

export const PAY_PER_USE =
  "X API pay-per-use (as of 2026): ~$0.015 per plain post, ~$0.20 per post that contains a link. Warn the user before posting links.";

export const REPLY_RESTRICTION =
  "Self-serve / pay-per-use: replies to someone else only succeed if they @mentioned you or quoted you. Enterprise is unrestricted. Self-replies (your own thread) are the intended thread mechanism.";

function unconfirmedAllowed(): boolean {
  return process.env.X_ORGANIC_ALLOW_UNCONFIRMED === "1";
}

/** Writes that publish, DM, delete, or hide require confirm=true after a named user ask. */
export function assertConfirmed(confirm: boolean | undefined, action: string): void {
  if (unconfirmedAllowed()) return;
  if (confirm === true) return;
  throw new PolicyError(
    `${action} Pass confirm=true only after the user explicitly named this action. ${NEVER_INVENT_COPY}`,
  );
}

export function assertUserCopy(text: string | undefined, field = "text"): void {
  if (text === undefined) return;
  if (typeof text !== "string") {
    throw new PolicyError(`${field} must be a string the user supplied. ${NEVER_INVENT_COPY}`);
  }
}

export function assertHasCopyOrMedia(text: string | undefined, mediaIds: string[] | undefined, field = "text"): void {
  const hasText = typeof text === "string" && text.length > 0;
  const hasMedia = Array.isArray(mediaIds) && mediaIds.length > 0;
  if (!hasText && !hasMedia) {
    throw new PolicyError(`Provide user-supplied ${field} and/or media_ids. ${NEVER_INVENT_COPY}`);
  }
}

export function assertNotBulkDm(participantIds: string[] | undefined): void {
  if (participantIds && participantIds.length > 1) {
    throw new PolicyError(
      `Refusing bulk/group unsolicited DMs (${participantIds.length} participants). Send to one named recipient. ${NO_SPAM}`,
    );
  }
}
