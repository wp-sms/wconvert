<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * **No code path in either plugin tree touches `wsms_engagements`** (ADR 0024).
 *
 * The invitation is easy to miss and easy to accept, which is why it needs a
 * test rather than a paragraph. `EngagementServiceProvider` registers
 * unconditionally in WSMS — not premium, not WooCommerce-specific —
 * `EngagementType` is an **open** interface whose `source` column exists to
 * "keep each consumer's key space its own", and `UNIQUE(source, type,
 * dedup_key)` makes writing one an idempotent upsert. A [[Lead]] with a
 * `converted_at`, a follow-up schedule and an A/B `variant`, for the cost of
 * one call, in a table built to be shared.
 *
 * **An engagement is a per-person lifecycle**, which is precisely what a Lead
 * is defined not to have — and housing it in WSMS's table is WORSE than
 * housing it locally, not better: ADR 0002's guard is a reviewer noticing a
 * migration, and there is no migration to notice when the lifecycle lives in
 * another plugin's schema. That is the whole reason this is a test in
 * WConvert's suite: it is the review that could not otherwise happen.
 *
 * Reading is out of reach rather than merely unwise, and needs no guard: a
 * [[Condition]] is evaluated in a browser that cannot say who it is
 * (ADR 0005, ADR 0017).
 *
 * Tokenised rather than grepped, for the same reason
 * `tests/unit/Lead/NoLeadIsEverUpdatedTest.php` is: the ADR, this docblock and
 * `CONTEXT.md`'s glossary all DISCUSS engagements at length, and a check that
 * flags the prose explaining itself earns an exception list — which is the one
 * thing it must never acquire.
 */
#[CoversNothing]
final class NoEngagementIsEverWrittenTest extends TestCase
{
    /**
     * How the table and its registry get named in code — the WSMS table
     * constant, the bare table name a `$wpdb` call would use, the service id
     * in WSMS's container, and the interface a registrant would implement.
     */
    private const ENGAGEMENT_NAMES = [
        'wsms_engagements',
        'TABLE_ENGAGEMENTS',
        'EngagementType',
        'EngagementRepository',
        'EngagementRepositoryInterface',
        'engagement.repository',
    ];

    public function testNoFileInEitherTreeNamesAnEngagementInCode(): void
    {
        $offenders = [];

        foreach (self::phpFiles() as $file) {
            $named = self::engagementNamesIn((string) file_get_contents($file));

            if ($named !== []) {
                $offenders[] = $file . ' (lines ' . implode(', ', $named) . ')';
            }
        }

        self::assertSame(
            [],
            $offenders,
            "A WConvert feature that genuinely needs per-person pending state is a signal to re-read\n"
                . "CONTEXT.md's Lead entry, not a signal to register an EngagementType (ADR 0024).\n"
                . implode("\n", $offenders)
        );
    }

    /**
     * @return list<string>
     */
    private static function phpFiles(): array
    {
        $root = dirname(__DIR__, 3);
        $files = [];

        foreach (['src', 'pro/src', 'bin'] as $tree) {
            $directory = $root . '/' . $tree;

            if (!is_dir($directory)) {
                continue;
            }

            /** @var \SplFileInfo $file */
            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory)) as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $files[] = $file->getPathname();
                }
            }
        }

        sort($files);

        return $files;
    }

    /**
     * Every line on which an engagement is named by CODE — comments and
     * docblocks stripped first.
     *
     * @return list<int>
     */
    private static function engagementNamesIn(string $php): array
    {
        $found = [];

        foreach (token_get_all($php) as $token) {
            if (!is_array($token) || in_array($token[0], [T_COMMENT, T_DOC_COMMENT, T_INLINE_HTML], true)) {
                continue;
            }

            $spelling = $token[0] === T_CONSTANT_ENCAPSED_STRING ? trim($token[1], '"\'') : $token[1];

            if (in_array($spelling, self::ENGAGEMENT_NAMES, true)) {
                $found[] = $token[2];
            }
        }

        return $found;
    }
}
