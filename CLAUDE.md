# WConvert

WordPress lead-capture plugin — popups, floating bars, slide-ins, and inline
forms, with goal-first creation. Runs standalone; integrates with WP SMS (WSMS)
when present.

Read [`CONTEXT.md`](CONTEXT.md) before using any domain term. The glossary is
load-bearing: several terms exist specifically to avoid collisions with WSMS's
vocabulary, and `Optin` / `Lead` / `Contact` / `Goal` / `Playbook` /
`Destination` all have precise meanings.

## Agent skills

### Issue tracker

GitHub Issues on `navidkashani/wconvert`, via the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, label strings unchanged. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context — root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

When a decision amends, corrects or completes an existing ADR, **edit that ADR
in the same commit** — inline, where the superseded claim sits, linking the
amending ADR. Recording it only on the map is what let twelve ADRs drift.

Reading them has the mirror rule: **an ADR's headline is not its current
state.** Read the inline "Amended by" / "Corrected by" notes before relying on
anything an ADR says. 0014 proposes a loader mode flag that 0028 killed, and
0015's absence table still reads "tree-shakes out" beside the note correcting
it. Skimming headlines builds the thing the ADR stopped saying.

### Authoring the design library

`.claude/skills/design-a-template` and `.claude/skills/design-a-playbook` —
this repo's own skills, and the only two. Both are agent-invocable; call them
rather than reconstructing the rules.

The design surface is `tools/design-library/`, a **sibling** of
`tools/design-system/` with the same conventions and a different subject:
visitor-facing designs rather than wp-admin screens. Its
`out/VOCABULARY.md` is **generated** from `resources/templates/manifest.json`
and is self-contained — paste it into a system with no repo context and it can
emit valid design JSON. Nothing there is authored twice, and `/tools` is in
`.distignore`.

### Slash commands

Always fully qualify: `/mattpocock-skills:implement`, never `/implement` — the
bare name does not resolve.

**`/code-review` is the trap.** Bare, it resolves to a *built-in* skill, not
`/mattpocock-skills:code-review`. Both are real, neither errors, and they do
different jobs. Name the plugin every time.

This project's chain: `/mattpocock-skills:to-tickets` to slice the spec,
`/mattpocock-skills:implement` per ticket, `/mattpocock-skills:tdd` at agreed
seams, `/mattpocock-skills:code-review` before merge.

Some of Matt's skills are user-invocable only, and the split does not follow
the chain. `to-tickets` and `implement` carry `disable-model-invocation`, so you
type those. **`tdd` and `code-review` do not** — an agent can and should call
them itself, at the seams and before merge.

The same holds for `research`, `domain-modeling`, `codebase-design`,
`prototype`, `grilling`, `wizard` and `diagnosing-bugs`. Assuming otherwise
costs a round trip per seam. Check rather than guess:

```bash
grep -l "disable-model-invocation: true" \
  ~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/*/skills/*/*/SKILL.md
```

## Reference codebase

WSMS 8 lives at
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`.

It is the **convention source** (PHP 8.1+, DI container, service providers,
Vite + React admin, PHPStan, PHPUnit, Playwright, premium build split) and the
**integration target** — but no code is shared and neither release cycle
constrains the other. Read it; never modify it.

## Shipping changes

**Work on a branch and open a PR. Never push to `main`.** `.github/workflows/ci.yml`
triggers on `pull_request` only — deliberately, since a PR is tested against the
result of merging it. So a direct push to `main` means no suite ever runs on the
change. There is no branch protection enforcing this; the discipline is the
enforcement. Merge once `CI / Required checks` is green, and require only that
check — never an individual row, which may legitimately be skipped.

**Releases are two tags, not one.** `free-vX.Y.Z` and `pro-vX.Y.Z` carry
independent version numbers and drive `release-free.yml` and `release-pro.yml`
out of the one monorepo (ADR 0030). Publishing a GitHub Release is the only
trigger — a tag push alone does nothing. The five guard conditions and the
artifact contract are programs under `bin/`, one per condition, called from
both workflows; see README's *Releasing* section before changing any of them.
**Free must be live on wp.org before any Pro release can pass its own guard** —
condition 5 anchors `WCONVERT_MIN_CORE` to the *published* free version.

**Verify on a real WordPress before claiming a thing works.** Tests passing is
not the same as the plugin booting: a fatal on activation, an asset that 404s,
or output sent during `plugins_loaded` all pass a green suite. Local's MySQL is
often down, so use the Playground one-liner in [`README.md`](README.md) — it
needs no database and mounts both plugins.

## Development phase

Active development, pre-release. No backward compatibility, deprecation shims,
or migration paths — change schemas, APIs, and interfaces directly.

## Database changes

Adding, altering, or dropping any table or column needs **explicit sign-off
first**. Say why the storage is needed and which table-free alternatives you
considered and rejected: a WordPress option, a transient, an existing table, or
computing the value on read.

This does not contradict the line above. Agreed schema needs no back-compat
shims; introducing new storage still needs a yes.
