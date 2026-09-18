# Launch checklist — `advisorppc-x-organic`

## Ready for users (0.2.0)

- [x] Scheduler module export `@advisorppc/x-organic/schedule`
- [x] HTTP auto-start worker + `npm run worker`
- [x] Vendor self-setup (Claude / ChatGPT / Cursor / Grok / AdvisorPPC)
- [x] Agents: publish_queue, mention_digest, inbox_digest, health
- [x] 40 tools, tests, typecheck
- [ ] Pushed `v0.2.0` / CI green

### Known limits

- X API still has no native schedule; this is AdvisorPPC's queue.
- Worker fires with env token, not per-request Bearer.
- Quote-posting Enterprise-only on self-serve; replies need a summon.
- Lives under `atmosphere-ai` until `advisorppc-org` can host.
