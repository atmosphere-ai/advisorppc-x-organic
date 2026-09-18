import assert from "node:assert/strict";
import { test } from "node:test";
import { XClient } from "../src/x/client.ts";
import { ConfigError, XApiError } from "../src/x/errors.ts";

test("refuses empty token", () => {
  assert.throws(() => new XClient({ accessToken: "" }), ConfigError);
});

test("GET encodes query and parses JSON", async () => {
  const calls: string[] = [];
  const client = new XClient({
    accessToken: "tok",
    fetchImpl: async (url, init) => {
      calls.push(`${init?.method} ${url}`);
      return new Response(JSON.stringify({ data: { id: "12", username: "me" } }), { status: 200 });
    },
  });
  const out = await client.get<{ data: { id: string } }>("/2/users/me", { "user.fields": "username" });
  assert.equal(out.data.id, "12");
  assert.match(calls[0]!, /GET https:\/\/api\.x.com\/2\/users\/me\?user\.fields=username/);
});

test("non-2xx becomes XApiError", async () => {
  const client = new XClient({
    accessToken: "tok",
    fetchImpl: async () =>
      new Response(JSON.stringify({ title: "Unauthorized", detail: "nope" }), { status: 401 }),
  });
  await assert.rejects(() => client.get("/2/users/me"), XApiError);
});

test("429 includes Retry-After and tells the caller to back off", async () => {
  const client = new XClient({
    accessToken: "tok",
    fetchImpl: async () =>
      new Response(JSON.stringify({ title: "Too Many Requests" }), {
        status: 429,
        headers: { "retry-after": "15", "x-rate-limit-reset": "1710000000", "x-rate-limit-remaining": "0" },
      }),
  });
  await assert.rejects(
    () => client.postJson("/2/tweets", { text: "hi" }),
    (err: unknown) => {
      assert.ok(err instanceof XApiError);
      assert.equal(err.status, 429);
      assert.equal(err.retryAfter, "15");
      assert.match(err.message, /Retry-After=15/);
      assert.match(err.message, /Back off/);
      return true;
    },
  );
});

test("listPages follows meta.next_token", async () => {
  let n = 0;
  const client = new XClient({
    accessToken: "tok",
    fetchImpl: async (url) => {
      n += 1;
      const u = String(url);
      if (n === 1) {
        assert.equal(u.includes("pagination_token"), false);
        return new Response(JSON.stringify({ data: [{ id: "a" }], meta: { next_token: "n2" } }), { status: 200 });
      }
      assert.match(u, /pagination_token=n2/);
      return new Response(JSON.stringify({ data: [{ id: "b" }], meta: {} }), { status: 200 });
    },
  });
  const page = await client.listPages<{ id: string }>("/2/tweets/search/recent", { query: "x" });
  assert.deepEqual(
    page.data.map((r) => r.id),
    ["a", "b"],
  );
});

test("me caches GET /2/users/me", async () => {
  let hits = 0;
  const client = new XClient({
    accessToken: "tok",
    fetchImpl: async () => {
      hits += 1;
      return new Response(JSON.stringify({ data: { id: "99", name: "A", username: "a" } }), { status: 200 });
    },
  });
  assert.equal((await client.me()).id, "99");
  assert.equal((await client.me()).username, "a");
  assert.equal(hits, 1);
});
