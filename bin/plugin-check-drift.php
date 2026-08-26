<?php

/**
 * plugin-check-drift.php — what the latest Plugin Check finds that the pin does not.
 *
 *     php bin/plugin-check-drift.php <pinned.json> <latest.json> <pinned-version>
 *
 * Writes a Markdown report on stdout. Exit 0 = no drift, and the report says
 * so. Exit 1 = there is something to read, which is what
 * .github/workflows/plugin-check-drift.yml turns into an issue.
 *
 * ============================================================================
 * WHY THE COMPARISON IS BY CODE.
 * ============================================================================
 * A finding is a file, a line, a column, a CODE and a message. Everything but
 * the code moves when the source moves, so comparing whole findings would
 * report drift every week that anybody edited a file — and a weekly job that
 * cries drift every week is a weekly job nobody opens.
 *
 * What is actually being asked is narrower and more useful: does the newer
 * checker implement a check the pinned one does not, or has it started
 * applying one it did not apply here before? That question is answered by the
 * SET OF CODES, and by nothing else in the record.
 *
 * ============================================================================
 * A PINNED ERROR IS ALSO NEWS.
 * ============================================================================
 * If the PINNED checker reports an error against `main`, the next release is
 * already blocked and nobody has been told — the release gate only runs on a
 * release. So that is reported too, separately and first, rather than being
 * filtered out because it is not "drift".
 *
 * ============================================================================
 * AND SO IS A RUN THAT DID NOT HAPPEN.
 * ============================================================================
 * An unreadable result file is not "no findings". The workflow lets both
 * checker runs fail on purpose, so the file may be absent or truncated, and
 * reporting that as a clean week is how this job would go quiet for months
 * without anybody noticing it had stopped working.
 *
 * @since 0.1.0
 */

declare(strict_types=1);

// The reader this shares with bin/plugin-check.sh's verdict step. Two readers
// hand-copying a parse would drift, and for this parse a drift means one of
// them silently reading a checker's output wrong.
require_once __DIR__ . '/plugin-check-results.php';

const DRIFT_NONE = 0;
const DRIFT_FOUND = 1;

$pinnedPath = $argv[1] ?? '';
$latestPath = $argv[2] ?? '';
$pinnedVersion = $argv[3] ?? '';

if ($pinnedPath === '' || $latestPath === '' || $pinnedVersion === '') {
    fwrite(STDERR, "usage: php bin/plugin-check-drift.php <pinned.json> <latest.json> <pinned-version>\n");
    exit(DRIFT_FOUND);
}

/**
 * The distinct codes in a set of findings, and one example line for each.
 *
 * @param list<array<string, mixed>> $findings
 * @return array<string, array{type: string, message: string, where: string, count: int}>
 */
function driftByCode(array $findings): array
{
    $byCode = [];

    foreach ($findings as $finding) {
        $code = (string) ($finding['code'] ?? '');

        if ($code === '') {
            continue;
        }

        if (isset($byCode[$code])) {
            $byCode[$code]['count']++;

            continue;
        }

        $byCode[$code] = [
            'type' => pluginCheckIsError($finding) ? 'ERROR' : 'WARNING',
            'message' => (string) ($finding['message'] ?? ''),
            'where' => sprintf('%s:%s', $finding['file'] ?? '?', $finding['line'] ?? '?'),
            'count' => 1,
        ];
    }

    return $byCode;
}

$pinned = pluginCheckFindings($pinnedPath);
$latest = pluginCheckFindings($latestPath);

/** @var list<string> $report */
$report = [];
$drifted = false;

if ($pinned === null || $latest === null) {
    $report[] = '## Plugin Check did not produce a readable result';
    $report[] = '';
    $report[] = 'One of the two runs produced nothing this job could read, so **no comparison was made**.';
    $report[] = 'That is reported rather than passed over: a drift job that reads an empty result as a';
    $report[] = 'clean week goes quiet for months without anybody noticing it stopped working.';
    $report[] = '';
    $report[] = sprintf('- pinned (`%s`): %s', $pinnedVersion, $pinned === null ? '**unreadable**' : 'read');
    $report[] = sprintf('- latest: %s', $latest === null ? '**unreadable**' : 'read');

    echo implode("\n", $report), "\n";

    exit(DRIFT_FOUND);
}

$pinnedByCode = driftByCode($pinned);
$latestByCode = driftByCode($latest);

// --- A pinned error blocks the next release, and only this job would know ----

$pinnedErrors = array_filter($pinnedByCode, static fn (array $entry): bool => $entry['type'] === 'ERROR');

if ($pinnedErrors !== []) {
    $drifted = true;
    $report[] = sprintf('## `main` fails the PINNED Plugin Check (%s)', $pinnedVersion);
    $report[] = '';
    $report[] = 'The next free release is already blocked. The release gate only runs on a release,';
    $report[] = 'so without this line nobody would find out until somebody tried to ship.';
    $report[] = '';

    foreach ($pinnedErrors as $code => $entry) {
        $report[] = sprintf('- **`%s`** ×%d — %s _(%s)_', $code, $entry['count'], $entry['message'], $entry['where']);
    }

    $report[] = '';
}

// --- The drift itself --------------------------------------------------------

$newCodes = array_diff_key($latestByCode, $pinnedByCode);

if ($newCodes !== []) {
    $drifted = true;
    $report[] = '## The latest Plugin Check finds codes the pin does not';
    $report[] = '';
    $report[] = sprintf(
        'Pinned at `%s`. Each code below is reported by the current wp.org checker and not by ours,',
        $pinnedVersion
    );
    $report[] = 'which means a wp.org review would see it and our release gate would not.';
    $report[] = '';

    foreach ($newCodes as $code => $entry) {
        $report[] = sprintf(
            '- %s **`%s`** ×%d — %s _(%s)_',
            $entry['type'] === 'ERROR' ? '❌' : '⚠️',
            $code,
            $entry['count'],
            $entry['message'],
            $entry['where']
        );
    }

    $report[] = '';
    $report[] = 'To act on this: fix the findings, then raise `.github/plugin-check-version` to the';
    $report[] = 'version that found them. Raising the pin without fixing them moves the failure into';
    $report[] = 'the release run.';
    $report[] = '';
}

// --- Codes the pin reports and the latest does not ---------------------------
//
// Not drift, and not a problem — a check that was removed or narrowed. Worth
// one line, because it is the case where raising the pin is free.

$goneCodes = array_diff_key($pinnedByCode, $latestByCode);

if ($goneCodes !== [] && $drifted) {
    $report[] = '### No longer reported by the latest';
    $report[] = '';

    foreach ($goneCodes as $code => $entry) {
        $report[] = sprintf('- `%s` — %s', $code, $entry['message']);
    }

    $report[] = '';
}

if (!$drifted) {
    $report[] = sprintf('## Plugin Check %s is still current enough', $pinnedVersion);
    $report[] = '';
    $report[] = sprintf(
        'The latest checker reports no code the pinned one does not, and the pinned one reports no error against `main`. %d finding(s) either side.',
        count($latest)
    );

    echo implode("\n", $report), "\n";

    exit(DRIFT_NONE);
}

echo implode("\n", $report), "\n";

exit(DRIFT_FOUND);
