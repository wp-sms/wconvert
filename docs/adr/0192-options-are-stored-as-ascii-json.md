# 0192: Options are stored as ASCII JSON

Accepted 2026-11-21. From issue #424. Amends
[ADR 0003](0003-published-set-projection-no-second-cache.md) inline, where it
says what the published set is stored as.

## Context

On a site whose `wp_options` table is utf8mb3, publishing a campaign with an
emoji in it saved the Optin row but never changed what visitors saw. The
editor said "It's live."

MySQL never saw the write. `wpdb::process_fields()` strips 4-byte characters
the column cannot hold, sees that the value changed, and returns false without
sending a query. `update_option()` returns false. `WpOptionStore::set()`
ignored that, and `PublishedSet` still fired `wconvert_published_set_changed`,
so the page cache was purged and refilled with the old set.

Every rebuild projects every published Optin. So while any one of them held an
emoji, every publish, unpublish, delete and timezone change failed, and the
whole live set was frozen. The Optin row was unaffected only because
`wp_json_encode()` escapes non-ASCII by default.

## Decisions

**1. `WpOptionStore` stores an array as `wp_json_encode()` output with the
default flags.** Everything above ASCII becomes `\uXXXX`, so the table's
charset no longer matters. It is one change at the `OptionStore` seam, and it
covers every option written through it: the published set, its per-revision
screen lists (`wconvert_flow_*`), Destinations, connections, delivery
failures, the catalogue cache and monthly targets. Scalars are stored as they
are. Every scalar written through the seam is a flag, a number or
`'yes'`/`'no'`.

**2. A string that decodes to an array reads back as that array.** Anything
else is returned as stored. An array written the old way is unserialised by
`get_option()` and passes straight through, so nothing needs migrating. It is
rewritten in the new format the next time it is written.

**3. Nothing reads these options with `get_option()` directly.** The two
reports that did (`BeaconController`, `JourneyStatsController`) now read screen
lists through `PublishedSet::flow()`.

**4. A refused write is reported.** `OptionStore::set()` returns whether the
table now holds the value. `update_option()` also answers false for an
unchanged value, so a false is checked against what is stored.
`PublishedSet::replaceWith()` returns false and announces nothing when either
write fails. Publish, unpublish, delete and declaring a winner throw
`PublishedSetNotSaved`, and their routes answer 500
`wconvert_published_set_not_saved`. The install rebuild leaves the schema
version unwritten, so the next `admin_init` retries. Timezone and policy
rebuilds have nobody to tell, and the next write retries.

**5. `Installer::VERSION` goes to 6**, so every existing set is rebuilt in the
new format on upgrade. That also unfreezes a site already stuck on #424.

## Rejected

- **Converting `wp_options` to utf8mb4.** It is a core table on the site
  owner's database, and a plugin altering it is out of bounds.
- **`JSON_UNESCAPED_UNICODE`, or serialising inside the projection.** Both
  put raw 4-byte UTF-8 back on the wire.
- **Escaping only the published set.** The screen lists fail in the same way,
  and so does every other store-backed option holding merchant text.

## Not covered

Direct `update_option()` writers that already check the result (the occasion
document in `OccasionStore`, and picker preferences in user meta) still
refuse an emoji on utf8mb3. They show "Could not save" rather than losing the
change silently. That is noted on #424.
