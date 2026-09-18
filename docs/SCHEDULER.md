# AdvisorPPC scheduler module

X API **cannot** natively schedule posts. This package ships a real queue the **AdvisorPPC backend can import**, and that **Claude, ChatGPT, Cursor, and Grok** drive through MCP tools. HTTP mode **starts the worker by itself**.

## Import (backend)

```ts
import { createScheduler } from "@advisorppc/x-organic/schedule";

const sched = createScheduler({ accessToken: process.env.X_ACCESS_TOKEN });
sched.start(); // persists to ADVISORPPC_JOBS_PATH (~/.advisorppc/jobs/x-organic.json)
```

Same shape on ads: `@advisorppc/x-ads/schedule`.

## Auto-setup

Call `x_organic_scheduler_setup` (or `x_ads_scheduler_setup`). It:

1. Creates the job store
2. Starts the in-process worker
3. Enables `health` + `publish_queue`
4. Returns paste-ready snippets for Claude, ChatGPT, Cursor, Grok, raw HTTP, and the AdvisorPPC backend

Optional `webhook_url`: digest agents POST JSON snapshots so **any** model vendor can triage mentions/inbox/analytics without this server inventing copy.

## Agents (organic)

| Agent | Does | Never does |
| --- | --- | --- |
| `publish_queue` | Fires due `schedule_create` jobs | Invent copy |
| `mention_digest` | Snapshot mentions | Auto-reply |
| `inbox_digest` | Snapshot DMs | Send DMs |
| `health` | `GET /2/users/me` | Write |

Ads agents: `publish_queue` (status changes), `analytics_digest`, `paused_audit`, `health`. Spend-changing jobs still require `confirm=true` at enqueue time.

## Worker

| Mode | Worker |
| --- | --- |
| `npm run start:http` | Auto-start unless `ADVISORPPC_SCHEDULER=0` |
| stdio | Off. `ADVISORPPC_SCHEDULER=1` or `npm run worker` |
| Backend import | `sched.start()` |

Scheduled fires use **`X_ACCESS_TOKEN` / `X_ADS_ACCESS_TOKEN` from the environment**, not a per-request Bearer. GET `/scheduler` on HTTP.

## Safety

- `schedule_create` requires `confirm=true` and user-supplied copy/ids
- Allowlisted tools only
- `publish_queue` disabled → due jobs are held
- No native X schedule is claimed
