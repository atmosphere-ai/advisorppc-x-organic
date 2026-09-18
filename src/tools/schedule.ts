import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { nextCronAfter, parseCron } from "../schedule/cron.js";
import { ORGANIC_AGENTS, ORGANIC_ALLOWLIST } from "../schedule/catalog.js";
import { assertAllowlisted, getScheduler, vendorSnippets } from "../schedule/index.js";
import { assertConfirmed } from "../policy/safety.js";
import { PolicyError } from "../x/errors.js";
import { text, UI_META } from "./common.js";

const confirm = z.boolean().optional();

export function registerScheduleTools(server: McpServer): void {
  server.registerTool(
    "x_organic_scheduler_status",
    {
      title: "Scheduler status",
      description:
        "AdvisorPPC's own job queue (X API has no native schedule). Shows worker, agents, upcoming jobs, last runs. HTTP mode starts the worker by itself.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: UI_META,
    },
    async () => {
      const s = getScheduler();
      const st = s.status();
      return text({
        running: st.running,
        jobs_path: st.jobs_path,
        settings: st.snapshot.settings,
        agents: st.snapshot.agents,
        jobs: st.snapshot.jobs.slice(0, 50),
        runs: st.snapshot.runs.slice(0, 20),
        catalog: ORGANIC_AGENTS,
      });
    },
  );

  server.registerTool(
    "x_organic_scheduler_setup",
    {
      title: "Auto-setup scheduler",
      description:
        "Self-configure the AdvisorPPC scheduler for Claude, ChatGPT, Cursor, Grok, raw HTTP, or the AdvisorPPC backend. Starts the in-process worker, writes the job store, returns paste-ready MCP snippets. Does not invent posts.",
      inputSchema: z.object({
        public_url: z.string().url().optional().describe("Public Streamable HTTP URL, e.g. https://mcp.advisorppc.com/x-organic/mcp"),
        vendor: z.enum(["claude", "chatgpt", "cursor", "grok", "http", "advisorppc"]).optional(),
        timezone: z.string().optional(),
        webhook_url: z.string().url().optional().describe("Optional POST target for digest agents (any model vendor)"),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: UI_META,
    },
    async (args) => {
      const s = getScheduler();
      s.store.patchSettings({
        timezone: args.timezone,
        webhook_url: args.webhook_url,
        public_url: args.public_url?.replace(/\/$/, ""),
      });
      s.start();
      s.store.setAgent("health", { enabled: true });
      s.store.setAgent("publish_queue", { enabled: true });
      const ctx = s.setupContext(args.public_url);
      const snippets = vendorSnippets(ctx);
      const picked = args.vendor ? { [args.vendor]: snippets[args.vendor] } : snippets;
      return text({
        ok: true,
        running: true,
        jobs_path: s.store.path,
        settings: s.store.load().settings,
        enabled_agents: ["health", "publish_queue"],
        snippets: picked,
        all_vendors: args.vendor ? undefined : snippets,
      });
    },
  );

  server.registerTool(
    "x_organic_scheduler_settings",
    {
      title: "Scheduler settings",
      description: "Get or patch timezone, digest webhook_url (Claude/ChatGPT/AdvisorPPC callback), tick_ms, public_url.",
      inputSchema: z.object({
        timezone: z.string().optional(),
        webhook_url: z.string().url().optional(),
        tick_ms: z.number().int().min(5000).max(300000).optional(),
        public_url: z.string().url().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: UI_META,
    },
    async (args) => {
      const s = getScheduler();
      if (args.timezone || args.webhook_url || args.tick_ms || args.public_url) {
        s.store.patchSettings({
          timezone: args.timezone,
          webhook_url: args.webhook_url,
          tick_ms: args.tick_ms,
          public_url: args.public_url?.replace(/\/$/, ""),
        });
      }
      return text(s.store.load().settings);
    },
  );

  server.registerTool(
    "x_organic_schedule_list",
    {
      title: "List scheduled jobs",
      description: "List AdvisorPPC queue jobs (not X native). Filter by status.",
      inputSchema: z.object({
        status: z.enum(["scheduled", "paused", "running", "done", "failed", "cancelled"]).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: UI_META,
    },
    async ({ status }) => {
      const jobs = getScheduler().store.load().jobs.filter((j) => !status || j.status === status);
      return text({ count: jobs.length, jobs });
    },
  );

  server.registerTool(
    "x_organic_schedule_create",
    {
      title: "Schedule a job",
      description:
        "Enqueue a future organic action on AdvisorPPC's queue (X cannot natively schedule). tool must be allowlisted. arguments must be the user-supplied copy/ids — never invent text. confirm=true after they named the time and the copy. Enables publish_queue so the worker will fire it. Kinds: once (run_at ISO), every (every_ms), cron (5-field).",
      inputSchema: z.object({
        name: z.string().optional(),
        kind: z.enum(["once", "every", "cron"]),
        run_at: z.string().optional().describe("ISO-8601 first run. Default now+1m for every/cron, required for once."),
        every_ms: z.number().int().min(60_000).optional(),
        cron: z.string().optional().describe("5-field cron in the scheduler timezone, e.g. 0 9 * * 1-5"),
        timezone: z.string().optional(),
        tool: z.string().describe("Allowlisted x_organic_* write tool"),
        arguments: z.record(z.string(), z.unknown()),
        max_runs: z.number().int().min(1).optional(),
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: UI_META,
    },
    async (args) => {
      assertConfirmed(args.confirm, "Scheduling a live organic action.");
      assertAllowlisted(args.tool);
      if (!ORGANIC_ALLOWLIST.has(args.tool)) throw new PolicyError("tool not allowlisted");
      const s = getScheduler();
      const tz = args.timezone || s.store.load().settings.timezone || "UTC";
      let run_at = args.run_at;
      if (args.kind === "once") {
        if (!run_at) throw new PolicyError("once jobs need run_at (ISO-8601 the user named).");
      } else if (args.kind === "every") {
        if (!args.every_ms) throw new PolicyError("every jobs need every_ms >= 60000");
        run_at = run_at || new Date(Date.now() + args.every_ms).toISOString();
      } else {
        if (!args.cron) throw new PolicyError("cron jobs need a 5-field expression");
        parseCron(args.cron);
        run_at = run_at || nextCronAfter(new Date(), args.cron, tz).toISOString();
      }
      if (args.tool === "x_organic_create_post" || args.tool === "x_organic_reply" || args.tool === "x_organic_create_thread") {
        const textArg = args.arguments.text;
        const posts = args.arguments.posts;
        if (typeof textArg !== "string" && !Array.isArray(posts)) {
          throw new PolicyError("Scheduled posts need user-supplied text (or posts[]). Never invent copy.");
        }
      }
      s.start();
      s.store.setAgent("publish_queue", { enabled: true });
      const job = s.store.addJob({
        name: args.name,
        kind: args.kind,
        run_at: run_at!,
        every_ms: args.every_ms,
        cron: args.cron,
        timezone: tz,
        action: { tool: args.tool, arguments: args.arguments },
        confirm: true,
        max_runs: args.max_runs,
      });
      return text({
        job,
        note: "Worker is running in this process (HTTP) or start `npm run worker` for stdio. Digest webhook is optional under scheduler_settings.",
      });
    },
  );

  server.registerTool(
    "x_organic_schedule_cancel",
    {
      title: "Cancel, pause, or resume a job",
      description: "Cancel (terminal), pause, or resume a named job id. confirm=true after the user named the job.",
      inputSchema: z.object({
        job_id: z.string().min(1),
        action: z.enum(["cancel", "pause", "resume"]).default("cancel"),
        confirm,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      _meta: UI_META,
    },
    async ({ job_id, action, confirm: ok }) => {
      assertConfirmed(ok, `${action} a scheduled job.`);
      const status = action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "scheduled";
      const job = getScheduler().store.patchJob(job_id, { status });
      return text({ job });
    },
  );

  server.registerTool(
    "x_organic_agents_list",
    {
      title: "List scheduler agents",
      description:
        "Built-in agents: publish_queue, mention_digest, inbox_digest, health. Digests never auto-reply; they snapshot and optionally POST webhook_url for Claude/ChatGPT/AdvisorPPC.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: UI_META,
    },
    async () => {
      const snap = getScheduler().store.load();
      return text({
        catalog: ORGANIC_AGENTS,
        state: snap.agents,
        webhook_url: snap.settings.webhook_url,
      });
    },
  );

  server.registerTool(
    "x_organic_agent_set",
    {
      title: "Enable or configure an agent",
      description:
        "Turn an agent on/off and set every_ms. Live agents (if any) need confirm=true. mention_digest / inbox_digest never send replies or DMs.",
      inputSchema: z.object({
        agent_id: z.enum(["publish_queue", "mention_digest", "inbox_digest", "health"]),
        enabled: z.boolean().optional(),
        every_ms: z.number().int().min(15_000).optional(),
        confirm,
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: UI_META,
    },
    async (args) => {
      const def = ORGANIC_AGENTS.find((a) => a.id === args.agent_id);
      if (!def) throw new PolicyError("unknown agent");
      if (def.live) assertConfirmed(args.confirm, `Enabling live agent ${def.id}.`);
      const s = getScheduler();
      if (args.enabled) s.start();
      const state = s.store.setAgent(args.agent_id, {
        enabled: args.enabled,
        every_ms: args.every_ms,
      });
      return text({ state, running: s.status().running });
    },
  );
}

export const SCHEDULE_TOOL_COUNT = 8;
