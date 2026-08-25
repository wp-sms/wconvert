<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * **Nothing in either plugin tree writes to a [[Lead]] row.**
 *
 * `tests/unit/Database/SchemaTest.php` holds the storage half of ADR 0002 —
 * no `status`, no `updated_at` — and that is the half a reviewer notices,
 * because it is a migration. This is the other half. `wconvert_leads` still
 * has six columns an `update()` could legally write to, and
 * {@see \WConvert\Database\Connection} still offers the method, because
 * `wconvert_optins` genuinely needs it: a soft delete IS an update.
 *
 * So the guard cannot be "there is no `update()`". It has to be "no `update()`
 * names this table", and that is a property of the SOURCE rather than of any
 * one class — which is why it is asserted by reading the source, the way
 * `bin/pro-php-scan.php` asserts the free/Pro boundary.
 *
 * #25 is the ticket that made this necessary. Erasure is the caller that
 * WOULD have written to a Lead row under the usual WordPress convention —
 * anonymising blanks the identifying columns — and ADR 0018 chose a `DELETE`
 * so that ADR 0002 needed no carve-out. A carve-out is exactly what a future
 * reader would add back, absent something that fails.
 */
#[CoversNothing]
final class NoLeadIsEverUpdatedTest extends TestCase
{
    /** The constant that names the lead log, however it is qualified. */
    private const LEAD_TABLE = 'TABLE_LEADS';

    /**
     * Every line on which `update()` is called with the lead log as its table.
     *
     * Tokenised rather than grepped, for the reason `bin/pro-php-scan.php`
     * gives at length: the question is whether this is CODE, and free's source
     * legitimately DISCUSSES the rule in prose. A regex flags every docblock
     * that explains why the rule exists, and a check that cries wolf earns an
     * exception list — which is the one thing this must never acquire.
     *
     * @return list<int>
     */
    private static function leadUpdatesIn(string $php): array
    {
        $tokens = array_values(array_filter(
            token_get_all($php),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $found = [];

        foreach ($tokens as $index => $token) {
            if (!is_array($token) || $token[0] !== T_STRING || $token[1] !== 'update') {
                continue;
            }

            // A method call, not a function named `update` and not a
            // declaration of one: `->update(` or `::update(`.
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
     * Does the argument list opening at `$open` name `$needle` in its first
     * argument?
     *
     * Depth-aware, so a nested call in a later argument cannot be mistaken for
     * the first one.
     *
     * @param list<array{0: int, 1: string, 2: int}|string> $tokens
     */
    private static function firstArgumentNames(array $tokens, int $open, string $needle): bool
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

            if (is_array($token) && $token[0] === T_STRING && $token[1] === $needle) {
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

        foreach (['/src', '/pro/src'] as $tree) {
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
    public function testNoFileInEitherTreeWritesToALeadRow(): void
    {
        $offenders = [];

        foreach (self::everyPhpFile() as $file) {
            foreach (self::leadUpdatesIn((string) file_get_contents($file)) as $line) {
                $offenders[] = basename($file) . ':' . $line;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'ADR 0002: a Lead has no lifecycle, so no update() may name wconvert_leads. '
                . 'ADR 0018 chose a DELETE for erasure precisely so this stayed true.'
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

        $this->assertSame([2], self::leadUpdatesIn($offending));
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

        $this->assertSame([], self::leadUpdatesIn($legitimate));
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

        $this->assertSame([], self::leadUpdatesIn($documented));
    }
}
