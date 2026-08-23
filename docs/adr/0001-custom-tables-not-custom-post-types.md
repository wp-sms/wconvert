# Custom tables, not custom post types

A custom post type is the reflexive answer for a user-authored WordPress
entity, so a reader will reasonably ask why `wconvert_optins` is a table.
Three of the CPT's four freebies do not cash out here: the admin list table is worthless because the
admin is React fed by REST, revisions only cover `post_content` unless every
meta key is separately registered as revisioned, and meta is actively harmful —
the front-end question "which published Optins could match this URL" becomes a
`meta_query`, a self-join per clause against unindexed `wp_postmeta.meta_value`.

Two reasons outweigh the querying one. An Optin's id is inlined into the JSON
payload of a **publicly cached page** and echoed in every analytics beacon; a
`wp_posts` auto-increment id is enumerable and leaks the site's total post
count, where WSMS's universal `CHAR(26)` ULID is opaque. And CLAUDE.md names
WSMS the convention source — WSMS has **zero** `register_post_type` calls
across 14 tables, so adopting CPTs would forfeit the ULID convention, the
`published_steps` draft/live pattern, and the repository shape all at once.

## Consequences

- WXR import/export is given up. Competitor import needs a bespoke mapper
  regardless of substrate, so this costs less than it appears.
- `wconvert_optins` copies `wsms_flows`: `config` (working draft) +
  `published_config` + `published_at`, promoted by one `publish()`.
- Repositories expose projections, never `SELECT *`. WSMS measured this:
  `FlowRepository::findNames()` records that dragging LONGTEXT config blobs
  exhausts PHP's memory limit at a few hundred rows.
- DDL is written **unaligned**. WSMS's aligned-whitespace DDL breaks dbDelta's
  field-type parser (142 false "changed type" diffs on a healthy schema),
  which is what forced them to hand-build a 324-line `SchemaDoctor`.
