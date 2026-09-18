/**
 * AdvisorPPC scheduler module — import this from the AdvisorPPC backend
 * or any Node host. HTTP MCP auto-starts the worker; stdio does not
 * unless ADVISORPPC_SCHEDULER=1.
 *
 *   import { createScheduler } from "@advisorppc/x-organic/schedule"
 *   const s = createScheduler({ accessToken })
 *   s.start()
 */
import { homedir } from "node:os";
import { ORGANIC_AGENTS, ORGANIC_ALLOWLIST } from "./catalog.js";
import { executeOrganicJob, runOrganicAgent } from "./execute.js";
import { defaultJobsPath, JobStore } from "./store.js";
import { getWorker, startWorker, type WorkerHandle } from "./worker.js";
import { vendorSnippets, type SetupContext } from "./setup.js";
import type { AgentDef, Job, JobStoreFile } from "./types.js";

export { JobStore, defaultJobsPath } from "./store.js";
export { parseCron, nextCronAfter, nextEvery, cronMatches } from "./cron.js";
export { startWorker, getWorker, runDue, nextJobState } from "./worker.js";
export { vendorSnippets } from "./setup.js";
export { ORGANIC_AGENTS, ORGANIC_ALLOWLIST, ORGANIC_PREFIX } from "./catalog.js";
export { executeOrganicJob, runOrganicAgent } from "./execute.js";
export * from "./types.js";

const WORKER_KEY = "x-organic";
let singleton: Scheduler | undefined;

export type CreateSchedulerOptions = {
  accessToken?: string;
  jobsPath?: string;
  autoStart?: boolean;
};

export type Scheduler = {
  store: JobStore;
  catalog: AgentDef[];
  start: () => WorkerHandle;
  stop: () => void;
  status: () => {
    running: boolean;
    jobs_path: string;
    snapshot: JobStoreFile;
  };
  setupContext: (publicUrl?: string) => SetupContext;
};

export function schedulerEnabledByEnv(): boolean {
  return process.env.ADVISORPPC_SCHEDULER === "1";
}

export function createScheduler(opts: CreateSchedulerOptions = {}): Scheduler {
  const path = opts.jobsPath || defaultJobsPath("x-organic");
  const store = new JobStore(path, ORGANIC_AGENTS);
  const token = opts.accessToken;

  const start = () =>
    startWorker(WORKER_KEY, {
      store,
      catalog: ORGANIC_AGENTS,
      executeJob: (job) => executeOrganicJob(job, token),
      runAgent: (id, settings) => runOrganicAgent(id, settings, token),
      tickMs: store.load().settings.tick_ms,
    });

  const sched: Scheduler = {
    store,
    catalog: ORGANIC_AGENTS,
    start,
    stop: () => getWorker(WORKER_KEY)?.stop(),
    status: () => ({
      running: Boolean(getWorker(WORKER_KEY)?.running()),
      jobs_path: path,
      snapshot: store.load(),
    }),
    setupContext: (publicUrl?: string) => ({
      server: "advisorppc-x-organic",
      command: "node",
      args: [`${process.cwd()}/dist/index.js`],
      envTokenName: "X_ACCESS_TOKEN",
      publicUrl: publicUrl || store.load().settings.public_url,
      jobsPath: path,
      workerRunning: Boolean(getWorker(WORKER_KEY)?.running()),
    }),
  };

  if (opts.autoStart || schedulerEnabledByEnv()) sched.start();
  return sched;
}

export function getScheduler(opts: CreateSchedulerOptions = {}): Scheduler {
  if (!singleton) singleton = createScheduler(opts);
  return singleton;
}

/** HTTP process: start the worker unless ADVISORPPC_SCHEDULER=0. */
export function ensureHttpWorker(accessToken?: string): Scheduler {
  const sched = getScheduler({ accessToken });
  if (process.env.ADVISORPPC_SCHEDULER !== "0") sched.start();
  return sched;
}

export function homedirJobsHint(): string {
  return `${homedir()}/.advisorppc/jobs`;
}

export function assertAllowlisted(tool: string): void {
  if (!ORGANIC_ALLOWLIST.has(tool)) {
    throw new Error(`${tool} cannot be scheduled. Allowlist: ${[...ORGANIC_ALLOWLIST].join(", ")}`);
  }
}

export function resetSchedulerForTests(): void {
  singleton?.stop();
  singleton = undefined;
}
