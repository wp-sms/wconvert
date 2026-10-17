# 0150: Free clears the page cache when the published set changes

Date: 2026-10-17. Status: accepted.
Amends [0004](0004-the-loader-survives-optimizers-not-just-caches.md) and
[0014](0014-pro-replaces-the-loader.md). Delivers #275.

Every page inlines the published set (ADR 0003), so a full-page cache freezes
it with the HTML. A schedule's ends are enforced in the browser (ADR 0050), so
a campaign whose dates pass disappears from a stale page on its own. Pausing
one early does not: the stale page still carries it, until the cache turns
over.

Only Pro's analytics module purged on `wconvert_published_set_changed`, so a
free site kept showing a paused campaign. Pausing is a free act, so the purge
has to be free's.

## Decisions

**1. `PageCache` moves to free.** It is `WConvert\Frontend\PageCache` in
`src/Frontend/PageCache.php`. Its lists are unchanged: the purge functions it
calls when they are installed, the actions it always fires, and
`wconvert_purge_page_cache` after every attempt, whether or not it found a
known cache.

**2. Free hooks it to `wconvert_published_set_changed`.** Only
`PublishedSet::replaceWith()` fires that action, and only admin and REST
requests run it. It also fires on rebuilds that change nothing visible to the
visitor: an upgrade, a timezone save, a permalink save. We accept the extra
purge on those rare admin saves. Telling them apart would need a second hook
and a comparison of old and new sets.

**3. Pro keeps its two lifecycle purges and drops its own published-set hook.**
Activation and deactivation still call `PageCache::purge()`. They run outside
the min-core guard, so they check that free's class exists first. With free
inactive there is no free loader on any cached page to clear.

**4. `purge()` returns the names of the purges it called.** These are the
installed cache plugins whose function or method it reached. An agent's
publish or pause reply (#284) will name them. The actions are not in the list:
firing one says nothing about whether anything listened.

**5. The object cache is still left alone**, for 0014's reason: what changed is
cached HTML, and flushing Redis would evict every other plugin's data.

`README.md` *Clearing the page cache* documents `wconvert_purge_page_cache`
with a Cloudflare example.
