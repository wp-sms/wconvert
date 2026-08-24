# No IP-based geo targeting in v1

Geo was listed as a v1 premium rule. It is the only rule in the vocabulary with
no answer on a cached page: the server cannot vary by location when the cache
does not vary, so the lookup has to happen in the browser, and a browser-side IP
lookup is an external request on every page view. That is wp.org Guideline 7
territory for a plugin whose free tier is its distribution, a third-party
dependency in the hot path, latency on every view, and it drags IP handling into
the consent and retention model for a single rule.

**Cut it.** In its place the vocabulary ships `timezone_region` — derived from
`Intl.DateTimeFormat().resolvedOptions().timeZone`, which costs no request, no IP
and no table at continent granularity — alongside the existing
`browser_language`.

## Consequences

- **It must not be called "geo" in the UI.** A rule labelled Geo that a VPN or a
  travelling visitor defeats generates support tickets; a rule labelled
  "Visitor's time zone" is exactly what it claims and defeats nothing.
- Country-level granularity needs a zone-to-country table of roughly 2KB gzipped
  inside an 8KB loader budget. That is a later decision to be made against a
  measurement, not a v1 commitment.
- **Nothing degrades into `timezone_region`.** This bullet originally read that
  the Playbook degradation mechanism is what a geo-wanting Playbook substitutes
  through. That seam turned out to have no branch for it:
  [ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)
  substitutes a premium **trigger**, drops a premium **condition** and upsells a
  premium **display type** — and geo is none of the three, because it is *cut*
  rather than premium. A rule absent from the manifest cannot be named by a
  Playbook at all, since entries are validated against it at registration
  ([ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md)). So a Playbook
  wanting this behaviour writes `timezone_region` directly, and there is no
  substitution entry to build. Corrected here rather than on the map, which never
  carried the original claim: it was written forward-looking in this ADR and the
  mechanism it predicted was later specified differently.
