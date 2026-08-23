# Storage and entity model

Type: grilling
Status: open

## Question

How are `Optin`, `Lead`, `Playbook`, `Goal`, and template data persisted, and
what are the relationships between them?

The consequential fork is **custom post type vs. custom tables** for Optins.
CPTs give you the WP admin plumbing, revisions, and meta for free, but pollute
`wp_posts`, make querying by rule/goal awkward, and scale badly on sites with
many optins. Custom tables invert every one of those.

Leads have a different profile again: append-only, potentially high-volume, and
explicitly *not* an entity with a lifecycle (see `CONTEXT.md`). Whatever holds
them should make it structurally hard to grow them into a contact system.

Must also settle: where the Goal lives on an Optin, how Playbook registry
entries are stored (they are data, not rows — bundled files? options? both?),
and what the per-URL front-end JSON payload is derived from.

Adopt the WSMS rule here: every proposed table or column needs justification
against a table-free alternative — a WP option, a transient, or computing on
read.
