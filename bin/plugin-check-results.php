<?php

/**
 * plugin-check-results.php — reading what `wp plugin check` wrote.
 *
 * A library, not a program. `require`d by bin/plugin-check-drift.php and by
 * the verdict step of bin/plugin-check.sh.
 *
 * ADR 0029 requires the programs of the gate to be PROGRAMS with no flags
 * between them, "so that no opt-out exists to be taken on the day it matters".
 * bin/pro-scan-support.php already draws the line this file sits on: that is
 * "a statement about entry points, not about file walkers", and two readers
 * hand-copying a parse would drift — which for this parse means one of them
 * silently reading a checker's output wrong.
 *
 * ============================================================================
 * WHY `strict-json` AND NOT `json`.
 * ============================================================================
 * Plugin Check's `--format=json` does NOT emit JSON. It emits, per file:
 *
 *     FILE: src/Thing.php
 *     [{"line":10,...},{"line":12,...}]
 *
 * repeated, with the `FILE:` lines between the arrays
 * (`Plugin_Check_Command::display_results()`). So a plugin with findings in two
 * files produces something no JSON parser will read, and a plugin with NO
 * findings produces no brackets at all. Both of those arrive at a naive reader
 * as "unparseable", and a gate that reports "could not read the result" for a
 * clean plugin is a gate that blocks every release.
 *
 * `--format=strict-json` emits ONE flat array of every finding
 * (`Plugin_Check_Command::display_results_summary()`, the `strict-` branch),
 * including `[]` when there is nothing. That is the format to ask for.
 *
 * `file` must be requested explicitly. It is present in the data — the `json`
 * format groups by it — but it is not in `get_check_default_fields()`, so
 * without `--fields=` every finding comes back with no idea which file it is
 * in, and a report that cannot say where is a report nobody can act on.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

/**
 * The fields to ask `wp plugin check` for, in the order a reader wants them.
 *
 * Named here rather than in the shell that runs the command, so that the
 * request and the parse cannot disagree about what a finding contains.
 */
const PLUGIN_CHECK_FIELDS = 'file,line,column,type,code,message';

/** The format flag that goes with those fields. See the note above. */
const PLUGIN_CHECK_FORMAT = 'strict-json';

/**
 * Every finding in a `wp plugin check --format=strict-json` result file, or
 * NULL when the run produced nothing readable.
 *
 * Null and `[]` are different answers and callers must treat them so: `[]` is a
 * plugin with no findings, and null is a checker whose output could not be
 * read. Reporting the second as the first is how a broken gate reads as a
 * clean one.
 *
 * @return list<array<string, mixed>>|null
 */
function pluginCheckFindings(string $path): ?array
{
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }

    $raw = (string) file_get_contents($path);

    // wp-env wraps every command it runs in a preamble AND a trailing
    // "✔ Ran ..." line, so the payload is the outermost [ ... ] rather than
    // everything from the first bracket onward — which would leave the
    // postamble attached and never parse.
    $start = strpos($raw, '[');
    $end = strrpos($raw, ']');

    if ($start === false || $end === false || $end < $start) {
        return null;
    }

    $decoded = json_decode(substr($raw, $start, $end - $start + 1), true);

    if (!is_array($decoded)) {
        return null;
    }

    /** @var list<array<string, mixed>> $findings */
    $findings = array_values(array_filter($decoded, 'is_array'));

    return $findings;
}

/**
 * One finding as a line somebody can act on.
 *
 * @param array<string, mixed> $finding
 */
function pluginCheckLine(array $finding): string
{
    return sprintf(
        '%s:%s:%s  %s  %s',
        $finding['file'] ?? '?',
        $finding['line'] ?? '?',
        $finding['column'] ?? '?',
        $finding['code'] ?? '?',
        $finding['message'] ?? ''
    );
}

/**
 * Whether a finding is an ERROR — the type that blocks.
 *
 * Everything that is not an ERROR is reported and passes. Plugin Check also
 * emits an `OTHER` type below a severity threshold, and it belongs with the
 * warnings: a gate that blocks on everything is a gate somebody turns off.
 *
 * @param array<string, mixed> $finding
 */
function pluginCheckIsError(array $finding): bool
{
    return strtoupper((string) ($finding['type'] ?? '')) === 'ERROR';
}
