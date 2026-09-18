import { PolicyError } from "./errors.js";
import { MEDIA_SUBSTITUTION_BAN } from "../policy/safety.js";
import { mediaFingerprint } from "./hash.js";

export const CHUNK_BYTES = 4 * 1024 * 1024;
export const SIMPLE_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_V2 = "https://api.x.com/2/media/upload";
const MEDIA_V11 = "https://upload.twitter.com/1.1/media/upload.json";

export type MediaDestination = "tweet" | "dm";

export type MediaCategory =
  | "tweet_image"
  | "tweet_gif"
  | "tweet_video"
  | "dm_image"
  | "dm_gif"
  | "dm_video";

export type MediaUploadResult = {
  media_key: string;
  media_id: string;
  category: MediaCategory;
  sha256: string;
};

export type MediaUploadOptions = {
  accessToken: string;
  body: Buffer;
  mimeType?: string;
  /** Organic posts use tweet_*; DMs use dm_*. Never amplify_video (that's ads). */
  destination?: MediaDestination;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxStatusPolls?: number;
};

function guessMime(buf: Buffer, hinted?: string): string {
  if (hinted) return hinted;
  if (buf.length >= 12) {
    const ascii = buf.subarray(4, 12).toString("ascii");
    if (ascii.includes("ftyp")) return "video/mp4";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 6 && buf.subarray(0, 6).toString("ascii").startsWith("GIF")) return "image/gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF") return "video/webm";
  return "image/png";
}

export function mediaCategory(mime: string, destination: MediaDestination = "tweet"): MediaCategory {
  const dm = destination === "dm";
  if (mime.startsWith("video/")) return dm ? "dm_video" : "tweet_video";
  if (mime.includes("gif")) return dm ? "dm_gif" : "tweet_gif";
  return dm ? "dm_image" : "tweet_image";
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

function fileName(mime: string): string {
  if (mime.includes("gif")) return "upload.gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "upload.jpg";
  if (mime.startsWith("video/")) return mime.includes("quicktime") ? "upload.mov" : "upload.mp4";
  if (mime.includes("webp")) return "upload.webp";
  return "upload.png";
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

function dataOf(json: Record<string, unknown>): Record<string, unknown> {
  const data = json.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : json;
}

function fail(status: number, json: Record<string, unknown>, what: string): never {
  throw new PolicyError(
    `${what} failed (${status}): ${JSON.stringify(json.errors ?? json.detail ?? json)}. ${MEDIA_SUBSTITUTION_BAN}`,
  );
}

export async function uploadMedia(opts: MediaUploadOptions): Promise<MediaUploadResult> {
  const mime = guessMime(opts.body, opts.mimeType);
  const destination = opts.destination ?? "tweet";
  const category = mediaCategory(mime, destination);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sha256 = mediaFingerprint(opts.body);
  const uploaded =
    !isVideoMime(mime) && opts.body.length <= SIMPLE_MAX_BYTES
      ? await simpleUpload(opts.accessToken, opts.body, mime, category, fetchImpl)
      : await chunkedUpload(
          opts.accessToken,
          opts.body,
          mime,
          category,
          fetchImpl,
          opts.sleep,
          opts.maxStatusPolls,
        );
  return { ...uploaded, sha256 };
}

async function simpleUpload(
  accessToken: string,
  buf: Buffer,
  mime: string,
  category: MediaCategory,
  fetchImpl: typeof fetch,
): Promise<Omit<MediaUploadResult, "sha256">> {
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(buf)], { type: mime }), fileName(mime));
  form.append("media_category", category);
  const res = await fetchImpl(MEDIA_V11, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const json = await parseJson(res);
  if (!res.ok) fail(res.status, json, "Media upload");
  const data = dataOf(json);
  const media_id = String(data.media_id_string ?? data.id ?? data.media_id ?? "");
  const media_key = String(data.media_key ?? (media_id ? `3_${media_id}` : ""));
  if (!media_key) fail(res.status, json, "Media upload");
  return { media_key, media_id: media_id || media_key, category };
}

async function chunkedUpload(
  accessToken: string,
  buf: Buffer,
  mime: string,
  category: MediaCategory,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxStatusPolls = 60,
): Promise<Omit<MediaUploadResult, "sha256">> {
  const initRes = await fetchImpl(`${MEDIA_V2}/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      media_type: mime,
      total_bytes: buf.length,
      media_category: category,
    }),
  });
  const initJson = await parseJson(initRes);
  if (!initRes.ok) fail(initRes.status, initJson, "Video INIT");
  const init = dataOf(initJson);
  const media_id = String(init.id ?? init.media_id_string ?? init.media_id ?? "");
  if (!media_id) fail(initRes.status, initJson, "Video INIT");

  let segment = 0;
  for (let offset = 0; offset < buf.length; offset += CHUNK_BYTES) {
    const slice = buf.subarray(offset, Math.min(offset + CHUNK_BYTES, buf.length));
    const form = new FormData();
    form.append("segment_index", String(segment));
    form.append("media", new Blob([new Uint8Array(slice)], { type: "application/octet-stream" }), `chunk${segment}`);
    const appendRes = await fetchImpl(`${MEDIA_V2}/${encodeURIComponent(media_id)}/append`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!appendRes.ok) {
      const json = await parseJson(appendRes);
      fail(appendRes.status, json, `Video APPEND segment ${segment}`);
    }
    segment += 1;
  }

  const finRes = await fetchImpl(`${MEDIA_V2}/${encodeURIComponent(media_id)}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const finJson = await parseJson(finRes);
  if (!finRes.ok) fail(finRes.status, finJson, "Video FINALIZE");
  const fin = dataOf(finJson);
  let media_key = String(fin.media_key ?? init.media_key ?? "");

  const processing = (fin.processing_info ?? finJson.processing_info) as
    | { state?: string; check_after_secs?: number }
    | undefined;
  if (processing && processing.state && processing.state !== "succeeded") {
    const status = await waitForProcessing(accessToken, media_id, fetchImpl, sleep, maxStatusPolls);
    media_key = status.media_key || media_key;
  }

  if (!media_key) {
    media_key = mime.startsWith("video/") ? `7_${media_id}` : `13_${media_id}`;
  }
  return { media_key, media_id, category };
}

async function waitForProcessing(
  accessToken: string,
  media_id: string,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
  maxStatusPolls: number,
): Promise<{ media_key: string }> {
  for (let i = 0; i < maxStatusPolls; i++) {
    const url = `${MEDIA_V2}?command=STATUS&media_id=${encodeURIComponent(media_id)}`;
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await parseJson(res);
    if (!res.ok) fail(res.status, json, "Video STATUS");
    const data = dataOf(json);
    const info = (data.processing_info ?? json.processing_info) as
      | { state?: string; check_after_secs?: number; error?: { message?: string } }
      | undefined;
    const state = info?.state ?? "succeeded";
    if (state === "succeeded") {
      return { media_key: String(data.media_key ?? json.media_key ?? "") };
    }
    if (state === "failed") {
      throw new PolicyError(
        `Video processing failed: ${info?.error?.message ?? JSON.stringify(info)}. ${MEDIA_SUBSTITUTION_BAN}`,
      );
    }
    const wait = Math.max(1, Number(info?.check_after_secs ?? 2)) * 1000;
    await sleep(wait);
  }
  throw new PolicyError(`Video processing timed out. ${MEDIA_SUBSTITUTION_BAN}`);
}
