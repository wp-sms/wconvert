# Template discovery and reviewed collections

Accepted 2026-09-30. Implements picker A inside the existing plugin. No CI or
real email/SMS delivery is part of this local implementation.

## One preparation and editing path

Goal-first creation browses a metadata-only Playbook index. Cards are grouped by
canonical design identity **after** applying Goal, business, format, search,
source pack and Saved filters. A selector chooses among matching use cases;
copy changes are not counted as different designs. Lists paginate at 24 cards.
Visible cards lazily request at most 24 actual Prefill compositions per request.

Setup inspection shows the shipping renderer at desktop/phone widths, every
screen and result, practical requirements and the existing local journey test.
A source revision and a prepared snapshot revision accompany creation. Changes
to the source or site configuration after inspection return 409; the user can
reload and inspect again. Draft creation and publication remain the existing
Optin paths. This introduces neither a second builder nor campaign scheduling.

Changing layout retains the existing Goal, content-transfer review, source
baseline, hard refusal rules and undoable draft application. Canonical stars and
pagination are shared; collections, occasions and setup choices do not replace
campaign content through this flow. Show all designs remains available.

## Collections, dates and ownership

A Collection is a reviewed discovery list, separate from a delivery pack. It
references exact campaign setups and optional before/during/after stages.
Counts reflect available matching setups and distinct canonical designs.
Featuring applies filters, site-date windows, explicit market choices and user
preferences before ranking. Empty matches are omitted; an empty stage falls back
to a populated stage. Manual arrows/scrolling expose up to five featured entries,
with all relevant collections available separately. There is no auto-rotation.

The server supplies the site day, timezone and clock reference. The browser
updates the site day as time passes, including while offline, without another
catalog request. Shared event ends are exclusive; site occasion ends are
inclusive. Collection expiry removes recommendations, not drafts or saved
campaigns. Open inspection does not jump away at midnight.

Saved design identities, hidden collections, event opt-outs and market
preferences are authenticated user meta, scoped to the current blog. A favorite
survives installed pack version changes through `pack:<pack-id>:<logical-id>`;
immutable template IDs still include the package digest for source baselines.
Removed designs remain named Saved entries that can be removed by the user.
Merchant-defined occasions use a non-autoloaded site option. Their names and
dates aid planning; no targeting, discount, campaign, or publication command is
stored. Writes use document revisions and bounded short-lived option leases;
a conflict requires reload. No table or column is introduced.

## Internal review and the future API

The repository studio compiles collection candidates from source fingerprints,
prepared setup revisions and current shared review records. Every dependency
and collection must be approved with visual, journey and native WordPress
evidence. Changing source, renderer or supporting evidence makes review stale.
`templates:collections:check` rebuilds and refuses stale or changed shipped
snapshots, and the release build runs it before staging. Studio and authoring files remain under excluded `/tools`; customers
receive published JSON plus translated labels. Runtime bundled collections also
verify referenced source hashes. The studio reads public authored data, not
customer accounts, campaign records or Leads.

The configured optional catalog additionally accepts a schema 2 immutable
manifest and bounded, same-origin pages pinned by SHA-256. All pages and exact
pack references validate before replacing the local cache. Normal discovery
uses local installed/cached data; refresh remains explicit. Schema 1 catalogs
cannot inject collections. See the [protocol](../template-discovery-api.md).

Hosting, a schema 2 publisher, paid-download entitlement, licensed media import
and historical archive cleanup remain separate integrations. The existing
128-file archive limit refuses further installs safely; no baseline is deleted.

## Initial publication and verification

Five collections reference 16 freshly re-reviewed setups. Black Friday is a
set of adaptable preparation ideas with a feature window beginning 16 October,
not a claim that a complete branded seasonal pack or conversion study exists.
The other 92 pilot setup approvals remain stale after prior renderer changes;
this change does not approve the whole 108-setup library.

See [implementation and validation](../reviews/template-picker-implementation-2026-09-30.md).
This amends ADRs 0082, 0083 and 0085. Existing Optin snapshots and metrics remain
independent of template updates and editorial collection membership.
