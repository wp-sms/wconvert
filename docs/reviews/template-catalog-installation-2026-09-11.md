# First template catalog installation slice

PR #152 was merged at the user's request despite GitHub's billing-blocked CI,
using the documented local verification. This work starts from merge 137ce8b.
The user selected a local sample catalog while the production service is prepared.

## Scope

Browse a pack, preview each design/screen at desktop or 320px, install, return to
the existing content-choice preview and apply/save in the editor. The sample
contains three already-reviewed designs with placeholders, not new artwork.
Versioned data, strict import/capability checks, SHA-256 download/preview checks,
immutable local versions, update messages and offline installed previews are
implemented. Existing campaigns and source baselines are not rewritten.

Only Free popup/inline designs are supported in this first format. Media,
downloaded Playbooks, paid pack fetch entitlement and production catalog hosting
remain separate work. This slice intentionally enters through the design picker;
it does not create a second Goal-first creation flow or a separate editor.

## Verification

Focused PHP and React tests exercise explicit connection, preview without
installation, install/use, failed refresh, local offline preview, digest changes,
version updates, original baselines, incompatible/unsafe inputs, corrupt local
files and idempotency. Full local validation passed: 1,861 PHP tests / 8,730 assertions; 2,314
JavaScript tests in 95 files under Node 22.23.2; TypeScript, ESLint, PHPStan,
all 50 bundled registrations, source contract and both Free/Pro admin builds.
The complete suites passed after the final review fixes. No visitor
renderer or loader production code changed. GitHub CI remains billing-blocked.

The local WordPress browser reached catalog check, pack preview, 320px previews,
installation, existing keep/sample-content preview, and apply/save of Reading slip
in a temporary inline draft. The live six original Optins were hashed beforehand.
No Optin is published and no lead or external delivery is created by this check.

The live HTTP integration also checked version 1.1.0 preview/install, retention
of the original 1.0.0 baseline and byte-unchanged saved draft, unavailable catalog
index with local installed preview, unauthenticated route rejection, and refusal
of unsafe HTTP/credential/private-host requests. The temporary update and draft
were removed. All six original Optins were unchanged. The sample catalog remains
configured locally with its 1.0.0 pack installed for further review.

Final recovery checks cover reinstalling corrupt local bytes and uninstalling
both catalog options plus owned archive files. The uninstall test runs in a
separate process with fake WordPress/database functions; it preserves unrelated
files and does not uninstall the live site.
