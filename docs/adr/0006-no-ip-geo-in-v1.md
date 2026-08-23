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
- The Playbook degradation mechanism is what a geo-wanting Playbook substitutes
  through, which is the same seam the free/premium line already uses.
