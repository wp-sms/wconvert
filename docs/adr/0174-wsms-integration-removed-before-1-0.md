# 0174: The WSMS integration is removed before 1.0

Accepted 2026-10-30. Supersedes 0022, 0023 and 0024, the WSMS sections of 0016
and 0025. Amends 0007, 0008, 0021, 0031, 0037, 0049, 0070, 0074, 0076,
0086, 0110 and 0148 where they name WSMS as a shipped [[Destination]].

The WSMS [[Destination]] pushed a [[Lead]] into WP SMS 8's contacts, in process.
WP SMS 8 has not shipped. WConvert 1.0 cannot release a Destination type whose
target does not exist on any site, and AGENTS.md is explicit that neither
product's release cycle constrains the other. So the integration comes out
rather than holding 1.0 back.

## Decisions

**1. The integration is deleted, not disabled.** `src/Destination/Wsms/` goes,
with its registration in `CoreServiceProvider` and the `SiteDependency::Wsms`
case that `WpSitePresence` answered. There is no flag, no dormant class and no
stub left to keep in step. Git history holds the code.

**2. Free registers two in-process types: lead-magnet email and MailPoet.**
[ADR 0007](0007-destinations-are-outbound-and-fallible.md)'s tier line is
unchanged — *in this process or over the wire* — and each remaining free type
still meets it for the same reason: `wp_mail()` is WordPress's own, and MailPoet
keeps its subscribers in this database behind a PHP API.
`TheFreeCapturePathStaysInProcessTest` and `bin/verify-destinations.php` now
argue from two types.

**3. "Grow my SMS list" stays.** The [[Goal]] never depended on WSMS. On free it
publishes in "Keep in WConvert only" mode, and its phone [[Lead]]s stay in the
Lead log, which readme.txt already describes. A merchant who wants them
elsewhere sends them through Pro's webhook. The SMS [[Playbook]]s carry an empty
`destination_hint.types`, and no Playbook names `wsms` any more.

**4. What the WSMS work taught WConvert stays.** E.164 canonicalisation
([ADR 0021](0021-lead-identity-is-computed-not-stored.md)), immutable Leads
([ADR 0002](0002-leads-are-immutable-by-schema.md)) and never confirming an
opt-in ([ADR 0016](0016-wconvert-never-confirms-an-optin.md)) all stand on their
own. Each one was first forced by WSMS, and none of them needs WSMS to be true.

## Consequences

- `NoEngagementIsEverWrittenTest`, which guarded
  [ADR 0024](0024-wconvert-writes-no-wsms-engagements.md)'s `wsms_engagements`
  boundary, is deleted with the push. With no WSMS code there is nothing it
  could catch.
- Tests that used WSMS as the generic in-process type now use MailPoet. Tests
  that need a phone-capable type use `FakeDestinationType::phoneCapable()`,
  because MailPoet is email-only.
- Dropping `wsms` from the hints changed the content hash of seven approved
  catalogue setups. Restoring it reproduces each approved revision exactly, so
  their approvals are carried by chained records, with the proof in
  `docs/reviews/wsms-hint-carry-2026-10-30/carry.json`.
- The naming notes in `CONTEXT.md` stay, because they explain why WConvert's
  words differ from WSMS's. WSMS also remains the convention source for code,
  so "ported from WSMS 8" comments stay true.
- **Reinstating the integration means reverting the PR that made this
  change.** When WSMS 8 ships, revert it, re-read ADRs 0022–0024 against the
  WSMS that actually shipped, and write a new ADR for whatever changed.
