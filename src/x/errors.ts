export class XApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfter?: string;
  readonly rateLimitReset?: string;
  readonly rateLimitRemaining?: string;

  constructor(
    status: number,
    message: string,
    body?: unknown,
    extra?: { retryAfter?: string | null; rateLimitReset?: string | null; rateLimitRemaining?: string | null },
  ) {
    super(message);
    this.name = "XApiError";
    this.status = status;
    this.body = body;
    this.retryAfter = extra?.retryAfter ?? undefined;
    this.rateLimitReset = extra?.rateLimitReset ?? undefined;
    this.rateLimitRemaining = extra?.rateLimitRemaining ?? undefined;
  }
}

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
