# Analytics and per-goal metrics

Type: grilling
Status: open
Blocked by: 01, 08

## Question

What does WConvert measure, how is it stored, and how does a first-class Goal
change what the analytics screen reports?

This is where the Goal decision either pays off or turns out to be decoration.
OptinMonster's Playbooks evaporate after creation, so their analytics can only
show generic conversion rate. WConvert keeps the Goal — so it can report against
what the Optin was *for*. That promise now has to be made concrete.

Open:

- **The metric set.** Impressions, conversions, conversion rate, dismissals — and
  what else. Is an impression "rendered" or "seen"?
- **Per-goal success metrics.** Each v1 Goal needs a countable headline number:
  what is it for "Grow my email list" versus "Recover abandoned carts" versus
  "Promote a sale or offer"? Any Goal without a clean answer here is a Goal that
  fails the `CONTEXT.md` countability test and should be reconsidered.
- **How events get recorded under page caching.** The page is cached; the beacon
  is not. REST endpoint, admin-ajax, or something else — and what that costs on a
  busy site.
- **Storage and aggregation.** Raw event rows grow without bound. Pre-aggregated
  daily rollups, retention/pruning policy, and what precision is lost. Table
  sign-off rule applies.
- Bot and prefetch filtering — impressions are trivially inflated by crawlers.
- Whether stats are per-Optin only, or roll up per-Goal on the dashboard (the map
  already decided a per-goal breakdown seeds the later goal-centric IA).

Blocked because the entity model must exist before events can reference it, and
the loader prototype determines what the client can cheaply report.
