# 0154: Agents act through WordPress Abilities

Date: 2026-10-17. Status: accepted.
Completes [0149](0149-an-occasion-groups-campaigns.md) §7. Delivers #282, #283,
#284 and #285.

Black Friday goes live on 20 November. A merchant should be able to ask an AI
agent (Claude, ChatGPT, Cursor…) to set it up, end it early, copy it to next
year, or say how it is doing. ADR 0149 §7 decided the boundary: agents read and
draft, and publishing needs a setting. This records how.

## Decisions

**1. Agents use WordPress Abilities, not a WConvert API.** WordPress 6.9 holds a
registry of [[Agent ability]]s (`wp_register_ability`), serves them over REST at
`/wp-json/wp-abilities/v1/abilities/<name>/run`, and the MCP Adapter turns them
into tools an AI app can call. WConvert registers fourteen, in one category,
`wconvert` ("WConvert campaigns"):

| Read (`readonly`) | Draft (`destructive: false`) | Gated (`destructive: true`) |
|---|---|---|
| `find-campaigns`, `get-campaign`, `list-occasions`, `get-occasion`, `find-designs`, `list-starters`, `review-campaign`, `get-stats` | `create-campaign`, `update-campaign`, `save-occasion` (idempotent), `copy-occasion` | `publish`, `pause` |

Every name is `wconvert/<verb>-<noun>`. Delete is never exposed. The plugin's
floor is 6.8, so each registration is guarded by the function it calls, and on
6.8 nothing registers and nothing fails.

**2. Every ability is the same capability the screens use.** The permission is
`manage_options` (`Routes::canManage`). An agent signs in as a WordPress user
with an application password, so the site can see what it did and revoke it by
revoking that password. The docs tell the merchant to give the agent a user of
its own.

**3. Writes go through the editor's routes.** `create-campaign` posts to
`POST /optins`, `update-campaign` patches `PATCH /optins/{id}`, `publish` and
`pause` post to `/optins/{id}/publish` and `/unpublish`, and `copy-occasion`
posts to `/occasions/{id}/copy` — each through `rest_do_request()`
(`InternalRest`), as Copy and Import already did (ADR 0153 §1). The args schema,
the vocabulary, the Goal and every refusal apply to an agent's write as to a
person's. Reads come off `GET /optins` and `GET /optins/{id}` the same way, so
suspension, A/B arms and the read-time detach of a deleted occasion (ADR 0149
§5) are the admin's answers.

**4. An agent never sees a tree or a lead.** Copy is read and written by
[[Slot Role]] (`SlotRoles::copyFrom` / `bind`); a design is named by its id.
A design from outside the library is `custom` and is never sent. Stats are
counts. `Reply::guard()` drops `tree`, `tokens`, `submissions` and every key that
could hold a [[Lead]] from every reply, at any depth, as a last line of defence
behind replies that are built from named fields.

**5. Replies are written for a new hire.** Each description says what the thing
is in WConvert's words, when to use it, what comes next, and one example, with
plain parameter names (`campaign_id`, `occasion_id`). Dates are `{wall,
timezone}` — the wall time the merchant set and the site's zone. Lists page at
20 (at most 50) with a total. Each reply carries a `next` hint. A refusal says
how to fix it: an unknown role lists the design's roles; markup in copy says
"plain text only"; a design this site cannot run names WConvert Pro or
`find-designs`; a countdown with no end, or an offer with no link, says which
field to add.

**6. A draft has a revision; a stale write is refused.** `ConfigRevision` is the
first 16 hex characters of a sha256 over the draft's name, Goal and config,
computed on read and stored nowhere. `get-campaign` returns it.
`PATCH /optins/{id}` takes an optional `expected_revision` and refuses a stale
one with 409 `wconvert_optin_changed`. The editor sends none yet. Updating a live
campaign changes its draft only; the reply says the live version is unchanged
until it is published.

**7. Publishing needs "Let AI agents publish".** One option,
`wconvert_agents_publish`, stored 1 or 0 and off by default, in Settings →
Connections & destinations → AI agents. While it is off, `publish` and `pause`
refuse in their permission check with "Publishing by agents is off — a person
can publish in WConvert → Campaigns". Reads and drafts never depend on it. For an
occasion they act on its campaigns, never its A/B variants, and name every
campaign they skipped or that refused. The reply names the page caches the
change cleared (`PageCache::lastPurged`).

**8. A dry run is the real chain.** The publish route's refusals moved, unchanged,
into `PublishReadiness`. The route answers with the first; `review-campaign`
lists them all. So "what stops this going live" has one answer.

**9. MCP only where the Adapter runs.** WConvert does not bundle the MCP Adapter
and never starts it. When the Adapter is running — its own plugin, or
WooCommerce's bundled copy with WooCommerce's MCP feature on — it fires
`mcp_adapter_init`, and WConvert adds its own server at `/wp-json/wconvert/mcp`
listing its fourteen tools. Every ability is also `meta.mcp.public`, so the
Adapter's default server lists them. Schemas use no union types, because the
Adapter's validator rejects `["integer", "null"]`; an optional value is left
out instead. Without the Adapter the abilities still answer over REST, which is
what scripts, n8n and Zapier use. WordPress picks the REST method from the
annotations: `GET` for a read (input in the query string, `input[campaign_id]=…`),
`DELETE` for `publish` and `pause` (they are `destructive`), and `POST` with a
JSON `{"input": {…}}` body for the rest. The Adapter (0.7) needs WordPress 6.9;
on 6.8 it will not activate, and WConvert registers nothing.

**10. The switch governs abilities, not the user.** An application password
carries its user's capabilities, so a client that skips the abilities and calls
WConvert's own routes directly can do whatever that user can — publishing
included. "Let AI agents publish" is what keeps an agent working through its
tools to drafts. The docs say so, and say to connect the agent through MCP, not
to hand it the password for a general REST client.

## Considered and rejected

- **WConvert's own MCP endpoint.** A second transport to secure and keep up to
  date, beside one WordPress already ships and other plugins already use.
- **Agents writing `config` directly.** It would hand an agent the node tree,
  and every refusal would have to be restated for it. Slot roles are already
  how a Playbook's words survive a design change.
- **A stored revision column.** The draft is the state; a column would be a
  second copy of it, and a schema change for a value computed in one line.
- **Publishing on by default, or per ability.** The point of drafts-only is that
  it is true until a person says otherwise, in one place.
