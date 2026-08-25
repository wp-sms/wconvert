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
    public static function sql(string $prefix, string $charsetCollate): string
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
}
