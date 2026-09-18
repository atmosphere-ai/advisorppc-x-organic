import { ConfigError, XApiError } from "./errors.js";

export type Json = Record<string, unknown>;

export type XListResponse<T = Json> = {
  data?: T | T[];
  includes?: Json;
  meta?: { next_token?: string; previous_token?: string; result_count?: number };
  errors?: unknown;
};

export type XClientOptions = {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type MeUser = { id: string; name: string; username: string } & Json;

function encodeQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) params.set(k, v.join(","));
    else if (typeof v === "boolean") params.set(k, v ? "true" : "false");
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function errorMessage(parsed: unknown, text: string, statusText: string): string {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Json;
    if (typeof obj.detail === "string" && obj.detail) return obj.detail;
    if (typeof obj.title === "string" && obj.title) {
      return obj.detail ? `${obj.title}: ${obj.detail}` : obj.title;
    }
    if (obj.errors) return JSON.stringify(obj.errors);
  }
  return text.slice(0, 400) || statusText;
}

export class XClient {
  readonly accessToken: string;
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  private meCache: MeUser | undefined;

  constructor(opts: XClientOptions) {
    if (!opts.accessToken) {
      throw new ConfigError(
        "Missing X user-context access token. Set X_ACCESS_TOKEN or pass Authorization: Bearer.",
      );
    }
    this.accessToken = opts.accessToken;
    this.baseUrl = (opts.baseUrl ?? "https://api.x.com").replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  async postJson<T = unknown>(path: string, json: unknown): Promise<T> {
    return this.request<T>("POST", path, {
      body: JSON.stringify(json),
      contentType: "application/json",
    });
  }

  async putJson<T = unknown>(path: string, json: unknown): Promise<T> {
    return this.request<T>("PUT", path, {
      body: JSON.stringify(json),
      contentType: "application/json",
    });
  }

  async delete<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }

  async me(): Promise<MeUser> {
    if (this.meCache) return this.meCache;
    const res = await this.get<{ data: MeUser }>("/2/users/me", {
      "user.fields": "created_at,description,name,username,public_metrics,verified,verified_type,profile_image_url,protected",
    });
    if (!res.data?.id) {
      throw new XApiError(500, "GET /2/users/me did not return data.id", res);
    }
    this.meCache = res.data;
    return res.data;
  }

  async listPages<T = Json>(
    path: string,
    query: Record<string, unknown> = {},
    { maxPages = 5 }: { maxPages?: number } = {},
  ): Promise<{ data: T[]; includes: Json; meta: Json }> {
    const data: T[] = [];
    const includes: Json = {};
    let meta: Json = {};
    let pagination_token: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const page = await this.get<XListResponse<T>>(path, { ...query, pagination_token });
      const rows = page.data === undefined ? [] : Array.isArray(page.data) ? page.data : [page.data];
      data.push(...rows);
      if (page.includes && typeof page.includes === "object") {
        for (const [k, v] of Object.entries(page.includes)) {
          const prev = includes[k];
          if (Array.isArray(prev) && Array.isArray(v)) includes[k] = [...prev, ...v];
          else includes[k] = v;
        }
      }
      meta = (page.meta as Json) ?? meta;
      const next = page.meta?.next_token;
      if (!next) break;
      pagination_token = next;
    }
    return { data, includes, meta };
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: string; contentType?: string } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${encodeQuery(opts.query)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = opts.contentType ?? "application/json";
    }
    const res = await this.fetchImpl(url, { method, headers, body: opts.body });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }
    if (!res.ok) {
      const msg = errorMessage(parsed, text, res.statusText);
      const extra = {
        retryAfter: res.headers.get("retry-after"),
        rateLimitReset: res.headers.get("x-rate-limit-reset"),
        rateLimitRemaining: res.headers.get("x-rate-limit-remaining"),
      };
      if (res.status === 429) {
        throw new XApiError(
          429,
          `X API rate limit (429) on ${method} ${path}. Retry-After=${extra.retryAfter ?? "unknown"} x-rate-limit-reset=${extra.rateLimitReset ?? "unknown"} remaining=${extra.rateLimitRemaining ?? "unknown"}. Back off; do not retry in a tight loop. ${msg}`,
          parsed,
          extra,
        );
      }
      throw new XApiError(res.status, `X API ${method} ${path} → ${res.status}: ${msg}`, parsed, extra);
    }
    return parsed as T;
  }
}

export function tokenFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.X_ACCESS_TOKEN || env.X_ORGANIC_ACCESS_TOKEN || env.X_BEARER_TOKEN || env.TWITTER_BEARER_TOKEN || "";
}
