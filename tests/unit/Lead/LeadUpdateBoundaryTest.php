<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/** Only journey acceptance and its initial queue handoff may update a Lead.
 * General profile editing remains forbidden (ADR 0002 amended by ADR 0103).
 * Real WordPress verification exercises immutable accepted values and erasure.
 */
#[CoversNothing]
final class LeadUpdateBoundaryTest extends TestCase
{
    /**
     * The two ways the lead log gets named.
     *
     * The constant is how `src/` spells it. The bare table name is how a
     * script reaches for it — `$wpdb->update($wpdb->prefix . 'wconvert_leads',
     * …)` is the shape a WordPress developer writes first, and it is exactly
     * what `bin/` would contain. Matching only the constant would have watched
     * the tree least likely to break the rule.
     */
    private const LEAD_TABLE = ['TABLE_LEADS', 'wconvert_leads'];

    /**
     * Every method on {@see \WConvert\Database\Connection} that can write to
     * a row which already exists.
     *
     * `insert()` is deliberately absent: initial capture creates the Lead, and `bin/verify-lead-log.php` relies on it — its retention fixture
     * inserts a Lead with an aged ULID rather than rewriting one, because
     * retention must remain anchored to first acceptance.
     *
     * `delete()` is absent for a different reason: removing a Lead is what ADR
     * 0018 chose ON PURPOSE, so that anonymising — which is an update — never
     * had to become one.
     *
     * `results()` and `row()` read. That leaves these two.
     */
    private const WRITE_METHODS = ['update', 'upsert'];

    /**
     * Every line on which a write method is called with the lead log as its
     * table.
     *
     * Tokenised rather than grepped, for the reason `bin/pro-php-scan.php`
     * gives at length: the question is whether this is CODE, and free's source
     * legitimately DISCUSSES the rule in prose. A regex flags every docblock
     * that explains why the rule exists, and a check that cries wolf earns an
     * exception list — which is the one thing this must never acquire.
     *
     * @return list<int>
     */
    private static function leadWritesIn(string $php): array
    {
        $tokens = array_values(array_filter(
            token_get_all($php),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $found = [];

        foreach ($tokens as $index => $token) {
            if (!is_array($token) || $token[0] !== T_STRING || !in_array($token[1], self::WRITE_METHODS, true)) {
                continue;
            }

            // A method call, not a function of the same name and not a
            // declaration of one: `->update(` or `::upsert(`.
            $arrow = $tokens[$index - 1] ?? null;
            $isCall = is_array($arrow)
                && in_array($arrow[0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON], true)
                && ($tokens[$index + 1] ?? null) === '(';

            if (!$isCall) {
                continue;
            }

            if (self::firstArgumentNames($tokens, $index + 1, self::LEAD_TABLE)) {
                $found[] = $token[2];
            }
        }

        return $found;
    }

    /**
     * Does the argument list opening at `$open` name any of `$needles` in its
     * first argument?
     *
     * Depth-aware, so a nested call in a later argument cannot be mistaken for
     * the first one. A STRING LITERAL counts as naming it, for the same reason
     * `bin/pro-php-scan.php` flags a namespace in one: the table a query runs
     * against is decided by the value, not by how it was spelled.
     *
     * @param list<array{0: int, 1: string, 2: int}|string> $tokens
     * @param list<string> $needles
     */
    private static function firstArgumentNames(array $tokens, int $open, array $needles): bool
    {
        $depth = 0;

        for ($i = $open; $i < count($tokens); $i++) {
            $token = $tokens[$i];

            if ($token === '(') {
                $depth++;

                continue;
            }

            if ($token === ')') {
                if (--$depth === 0) {
                    return false;
                }

                continue;
            }

            if ($token === ',' && $depth === 1) {
                return false;
            }

            if (!is_array($token)) {
                continue;
            }

            if ($token[0] === T_STRING && in_array($token[1], $needles, true)) {
                return true;
            }

            if ($token[0] === T_CONSTANT_ENCAPSED_STRING && in_array(trim($token[1], '"\''), $needles, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private static function everyPhpFile(): array
    {
        $root = dirname(__DIR__, 3);
        $files = [];

        // `bin/` too. It holds scripts that run inside WordPress with a live
        // `$wpdb` — `bin/verify-lead-log.php` writes to the lead log by
        // design — so leaving it out would exempt the tree most likely to
        // reach for a quick `UPDATE`.
        foreach (['/src', '/pro/src', '/bin'] as $tree) {
            /** @var \RecursiveIteratorIterator<\RecursiveDirectoryIterator> $iterator */
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root . $tree));

            foreach ($iterator as $file) {
                if ($file instanceof \SplFileInfo && $file->getExtension() === 'php') {
                    $files[] = $file->getPathname();
                }
            }
        }

        sort($files);

        return $files;
    }

    /**
     * The claim. Every file in both trees, and not one of them.
     */
    public function testOnlyTheAcceptedJourneyAndItsHandoffCanUpdateALead(): void
    {
        $offenders = [];

        foreach (self::everyPhpFile() as $file) {
            foreach (self::leadWritesIn((string) file_get_contents($file)) as $line) {
                $offenders[] = basename($file);
            }
        }

        $this->assertSame(
            ['SubmissionDispatcher.php', 'JourneyCapture.php'],
            array_values(array_unique($offenders)),
            'ADR 0103: only accepted additions and their initial handoff may update the combined capture record.'
        );

        $this->assertNotSame([], self::everyPhpFile(), 'the scan must have had something to look at');
    }

    /**
     * The scanner can fail. A guard that cannot is a comment with a green tick
     * beside it.
     */
    public function testTheScannerCatchesAnUpdateAgainstTheLeadLog(): void
    {
        $offending = <<<'PHP'
        <?php
        $this->db->update(Connection::TABLE_LEADS, ['email' => null], ['id' => $id]);
        PHP;

        $this->assertSame([2], self::leadWritesIn($offending));
    }

    /**
     * **The table named as a string, which is how a script reaches for it.**
     *
     * `src/` goes through `Connection::TABLE_LEADS`, so matching only the
     * constant would have watched the tree least likely to break the rule and
     * ignored `bin/`, where a live `$wpdb` is in scope and the quick spelling
     * is the obvious one.
     */
    public function testTheScannerCatchesTheTableNamedAsAString(): void
    {
        $offending = <<<'PHP'
        <?php
        $wpdb->update($wpdb->prefix . 'wconvert_leads', ['email' => null], ['id' => $id]);
        PHP;

        $this->assertSame([2], self::leadWritesIn($offending));
    }

    /**
     * **The upsert, which is the write #26 added.**
     *
     * `INSERT ... ON DUPLICATE KEY UPDATE` against the lead log would be a
     * write to a row that already existed — an update in every sense except
     * the method name, which is precisely the shape a scan for one name would
     * have missed.
     */
    public function testTheScannerCatchesAnUpsertAgainstTheLeadLog(): void
    {
        $offending = <<<'PHP'
        <?php
        $this->db->upsert(Connection::TABLE_LEADS, 'INSERT INTO %i (id) VALUES (%s) ON DUPLICATE KEY UPDATE id = id', $id);
        PHP;

        $this->assertSame([2], self::leadWritesIn($offending));
    }

    /**
     * And the upsert that is legitimate. `wconvert_stats` is the one table it
     * exists for, and counting an act there is the whole of its call sites.
     */
    public function testTheScannerIgnoresTheUpsertAgainstTheCounters(): void
    {
        $legitimate = <<<'PHP'
        <?php
        $this->db->upsert(Connection::TABLE_STATS, self::INCREMENT, $optinId, $statDate, $kind->value);
        PHP;

        $this->assertSame([], self::leadWritesIn($legitimate));
    }

    /**
     * **The insert stays legal**, and this is the assertion that says so out
     * loud. An insert is the one write a Lead takes, so a scanner that grew to
     * flag it would fail the capture path itself.
     */
    public function testTheScannerIgnoresTheOneWriteALeadDoesTake(): void
    {
        $legitimate = <<<'PHP'
        <?php
        $this->db->insert(Connection::TABLE_LEADS, $row);
        PHP;

        $this->assertSame([], self::leadWritesIn($legitimate));
    }

    /**
     * And it does not fire on the update that is legitimate. An Optin's soft
     * delete IS an update, which is why `update()` cannot simply be removed
     * from the interface (ADR 0020).
     */
    public function testTheScannerIgnoresAnUpdateAgainstAnotherTable(): void
    {
        $legitimate = <<<'PHP'
        <?php
        $this->db->update(Connection::TABLE_OPTINS, ['deleted_at' => $now], ['id' => $id]);
        PHP;

        $this->assertSame([], self::leadWritesIn($legitimate));
    }

    /**
     * Prose about the rule is not a breach of it. Free's source explains at
     * length why a Lead is never updated, and every one of those sentences
     * names the table.
     */
    public function testTheScannerIgnoresTheRuleBeingDiscussedInAComment(): void
    {
        $documented = <<<'PHP'
        <?php
        /** Never `update(Connection::TABLE_LEADS, ...)` — a Lead has no lifecycle. */
        $this->db->insert(Connection::TABLE_LEADS, $row);
        PHP;

        $this->assertSame([], self::leadWritesIn($documented));
    }
}
