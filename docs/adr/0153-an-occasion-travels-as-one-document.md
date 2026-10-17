# 0153: An occasion travels as one document

Date: 2026-10-17. Status: accepted.
Amends [0149](0149-an-occasion-groups-campaigns.md). Delivers #279 and #280.

A merchant who ran Black Friday this year wants it again next year without
rebuilding four campaigns. An agency wants to hand the same occasion to a
client's site. Both need the occasion and its campaigns as one unit.

## Decisions

**1. Every campaign is created through `POST /optins`, as a draft.** Copy and
Import call `rest_do_request()` against the route the editor uses. The args
schema, the vocabulary, the Goal and every refusal in `OptinController::store()`
apply to a copied or imported campaign as they do to a typed one. That route
writes drafts only, so neither action can publish. An original campaign is
never written. Variants are not carried, the same as Duplicate.

**2. The occasion is written first, through `OccasionStore`.** The campaigns
link to it, and the create refuses a link to an occasion that does not exist
(ADR 0149, as completed by #276). An id already taken gets `-2`, `-3`… added.
"Taken" includes the ids of deleted occasions, because their campaigns still
carry them (ADR 0149 §5).

**3. Copy to next year moves wall-clock strings, never instants.**
`NextYear` adds one to the year digits of `Y-m-d` and `Y-m-d H:i`. A schedule
is the merchant's wall time (ADR 0050), so 02:30 stays 02:30 across a DST
change. 29 February becomes 28 February. The year in the occasion's name and
id moves. If the name has no year, the next year is appended. A campaign's name
changes only where it already holds the year. The analytics label is cleared,
as Duplicate clears it. The calendar date is kept: a sale tied to a weekday,
like Black Friday, needs its dates checked, and the confirm dialog says so.

**4. The document.**

```json
{"format":"wconvert-occasion","schema":1,
 "occasion":{"id":"black-friday-2026","name":"Black Friday 2026","start":"2026-11-20","end":"2026-12-01"},
 "campaigns":[{"name":"…","goal":"promote_offer","display_type":"floating_bar",
   "design":"<library template id>","copy":{"<role>":"…"},"link":"/black-friday/",
   "targeting":{…},"frequency":{…},"display_rules":{…},
   "starts_at":"2026-11-20 00:00","ends_at":"2026-12-02 00:00"}]}
```

- `copy` is `SlotRoles::copyFrom(tree)`, the same seam a Playbook binds to.
- `design` is the config's library template id. A design the library does not
  hold exports as `design: null` with its whole `template`, so the round trip
  still works.
- `link` is the first link button's `href`. Import writes it into every link
  button.
- Destinations, A/B arms, teasers and placement do not travel. They name things
  on one site, and the draft asks for them before it publishes.
- A campaign with no `display_rules` imports with the fresh-setup plan
  (`DisplayPlan::immediate()`).

**5. Import checks the whole document before it writes anything.** A wrong
value answers 422 with `errors` keyed by path (`campaigns.2.starts_at`), and
nothing is created. After that, a campaign this site cannot hold is refused on
its own and named in the reply: a display type other than popup or inline on
free (the `PackValidator` rule), a design the library does not have, or a
design for another display type. The route's own refusals (a Pro-only Goal, for
example) are named the same way. The reply is
`{occasion, created, refused: [{name, reason}]}`.

**Rejected: reusing the template transfer (`/template-transfer`).** It carries
one design. An occasion's value is the set of campaigns and their dates, and
the words travel by Slot Role, so one JSON document is enough.
