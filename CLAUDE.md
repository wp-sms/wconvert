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
