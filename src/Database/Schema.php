<?php

namespace WConvert\Database;

defined('ABSPATH') || exit;

/**
 * The canonical DDL for every WConvert table. One source, read by activation
 * and by the upgrade path, so detection and repair see exactly what a fresh
 * install receives.
 *
 * ============================================================================
 * THE DDL BELOW IS UNALIGNED, AND THAT IS NOT A STYLE CHOICE.
 * ============================================================================
 * dbDelta parses each column line by splitting on whitespace. Padding the type
 * column into a neat block breaks its field-type parser: WSMS's aligned DDL
 * produces 142 false "changed type" diffs on a healthy schema, which is what
 * forced them to hand-build a 324-line SchemaDoctor to undo the damage
 * (ADR 0001). One space between a column and its type. Do not tidy this.
 *
 * `PRIMARY KEY  (id)` keeps its two spaces for the same family of reasons —
 * that exact spelling is what dbDelta's own documentation requires.
 *
 * @since 0.1.0
 */
final class Schema
{
    /**
     * Every table, in one string.
     *
     * dbDelta takes them together, so {@see Installer} runs one call however
     * many tables there are — and a table added without being appended here is
     * a table no install ever creates.
     */
    public static function sql(string $prefix, string $charsetCollate): string
    {
        return self::optins($prefix, $charsetCollate)
            . self::leads($prefix, $charsetCollate)
            . self::stats($prefix, $charsetCollate);
    }

    /**
     * `wconvert_optins` — an Optin is user-authored content that outlives the
     * request, queryable by `goal`, and joined at report time by analytics.
     *
     * The seven columns are the whole approved shape. There is no `created_at`
     * and no `updated_at`: the id is a ULID, so its leading 48 bits already
     * are the creation time and `ORDER BY id` already is `ORDER BY created_at`.
     *
     * `deleted_at` is how an Optin is deleted, and the only way. A hard delete
     * orphans every conversion count that references it (ADR 0020).
     */
    private static function optins(string $prefix, string $charsetCollate): string
    {
        return "CREATE TABLE {$prefix}wconvert_optins (
id CHAR(26) NOT NULL,
name VARCHAR(255) NOT NULL,
goal VARCHAR(64) NOT NULL,
config LONGTEXT,
published_config LONGTEXT,
published_at DATETIME NULL,
deleted_at DATETIME NULL,
PRIMARY KEY  (id),
KEY idx_goal (goal)
) {$charsetCollate};\n";
    }

    /**
     * `wconvert_leads` — the [[Lead]] log, and **the capture itself**.
     *
     * Not a [[Destination]] (ADR 0007): written first and always, not
     * configurable, not optional, and if it fails the capture failed.
     *
     * ========================================================================
     * THERE IS NO `status` COLUMN AND NO `updated_at` COLUMN.
     * ========================================================================
     * Their absence is the enforcement mechanism, not an oversight (ADR 0002).
     * A Lead is an EVENT — one person submitted one form, at one time — and it
     * is never confirmed, unsubscribed, bounced or re-engaged. A row with no
     * mutable state cannot acquire a lifecycle without a migration a reviewer
     * will see. **Do not "fix" this.** `tests/unit/Database/SchemaTest.php`
     * fails the day either appears.
     *
     * `email` and `phone` are real indexed columns because they are the
     * identity keys: identity is computed at read by grouping over them, never
     * stored, so there is no person key and no person table (ADR 0021). They
     * are indexed and **not unique** — Leads are never deduplicated, and one
     * person submitting two forms did two things. Everything else the Optin
     * captured, the [[Consent Record]] included, goes in one `fields` JSON.
     *
     * `created_at` is a real column even though a ULID's leading 48 bits
     * already carry the minting time, which is why `wconvert_optins` has none.
     * It earns its place as the [[Consent Record]]'s timestamp, to the same
     * second — there is no second one (ADR 0032), and evidence of consent with
     * no time on it is evidence of very little.
     *
     * It does NOT earn it as the retention prune's range. That range is over
     * the primary key: the ULID's leading bits are stamped in the same
     * statement as this column, so `id < :boundary` names the same rows and
     * costs no index of its own (ADR 0033).
     *
     * **Two indexes and no more**, and #25 kept it that way. It wrote the
     * per-Optin listing and the retention prune this comment was holding a
     * sign-off open for, and needed neither `idx_optin_created` nor
     * `idx_created`: the prune is a range over the primary key, the listing
     * walks that key backwards under a LIMIT, and the grouping view is two
     * aggregates that each use an index already here (ADR 0033). An index is
     * paid on every capture and read by one admin on demand, which is the
     * asymmetry that decided it. The bulk re-push #30 will want is still an
     * open question for #30.
     */
    private static function leads(string $prefix, string $charsetCollate): string
    {
        return "CREATE TABLE {$prefix}wconvert_leads (
id CHAR(26) NOT NULL,
optin_id CHAR(26) NOT NULL,
email VARCHAR(255) NULL,
phone VARCHAR(20) NULL,
fields LONGTEXT,
created_at DATETIME NOT NULL,
PRIMARY KEY  (id),
KEY idx_email (email),
KEY idx_phone (phone)
) {$charsetCollate};\n";
    }

    /**
     * `wconvert_stats` — the whole of analytics, as daily counters.
     *
     * **There is no event table** (ADR 0019). A modest site — 10k pageviews a
     * day, one popup sitewide — writes ~3.65M raw rows a year; the same site as
     * daily counters, at 20 active Optins across four kinds, writes ~29k, and
     * the index stays in the buffer pool permanently. That gap is not close at
     * any site size a wp.org plugin will meet, and the price of it is written
     * down rather than hidden: **you can never recompute**, and there is no
     * hour-of-day breakdown, ever.
     *
     * ========================================================================
     * THE PRIMARY KEY IS THE MECHANISM, NOT DECORATION.
     * ========================================================================
     * `(optin_id, stat_date, kind)` is what makes
     * `INSERT ... ON DUPLICATE KEY UPDATE count = count + 1` atomic at the
     * database: no increment is ever lost, and there is no read-modify-write
     * race to reason about. A surrogate `id` would make the upsert collide
     * with nothing and express nothing at all, so there is none.
     *
     * **And still no secondary index**, though #28 wrote the dashboard's read
     * and it is not the shape ADR 0019 predicted. It is a date range across
     * EVERY Optin — the screen reports on all of them — and with `optin_id`
     * leftmost that cannot use this key and is a scan. It stays unindexed
     * anyway: the table is booked at ~29k rows a year,
     * {@see \WConvert\Stats\StatRange::MAX_DAYS} caps the window to one of
     * them, and an index here would be paid on every beacon to save one admin
     * screen a read it takes on demand (ADR 0034). That is the same asymmetry
     * ADR 0033 decided the same way for the lead log.
     *
     * A row carries **no `goal`, no `had_email`, no `had_phone` and no display
     * type** (ADR 0020). Whether a Conversion carried an email is a property of
     * the Optin's form rather than of the moment, so it is constant across
     * every row that Optin will ever produce — and the join interpretation
     * needs is to `wconvert_optins`, which is soft-deleted and never erased.
     * That is also why an Optin must never be hard-deleted: a removed row makes
     * every count referencing it uninterpretable.
     *
     * `kind` is `VARCHAR(32)` and not an `ENUM`, though it is a closed set of
     * four. The set is closed in PHP by {@see \WConvert\Stats\StatKind}, where
     * adding a case is a code change a reviewer reads; as an `ENUM` it would be
     * a schema change, which is the more expensive half of the same edit and
     * buys nothing the enum does not already enforce.
     *
     * `stat_date` is a `DATE` in the **site's** timezone, not UTC, because the
     * dashboard says "Today" and that has to mean the merchant's today
     * ({@see \WConvert\Stats\StatDay}). `count` is `INT UNSIGNED`: 4.29 billion
     * of one kind on one Optin in one day is not a number to plan for.
     */
    private static function stats(string $prefix, string $charsetCollate): string
    {
        return "CREATE TABLE {$prefix}wconvert_stats (
optin_id CHAR(26) NOT NULL,
stat_date DATE NOT NULL,
kind VARCHAR(32) NOT NULL,
count INT UNSIGNED NOT NULL DEFAULT 0,
PRIMARY KEY  (optin_id,stat_date,kind)
) {$charsetCollate};\n";
    }
}
