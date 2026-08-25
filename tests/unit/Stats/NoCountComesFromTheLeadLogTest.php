<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * **No reported number comes from `wconvert_leads`.**
 *
 * ============================================================================
 * THIS IS THE DERIVATION ADR 0018 DEPENDS ON NOT EXISTING.
 * ============================================================================
 * Erasure `DELETE`s Lead rows — chosen so that anonymising, which is an
 * update, never had to become one against a table with no update path
 * (ADR 0002, ADR 0018). That choice is safe **only** while no metric reads
 * those rows. If "Leads with an email" were a `COUNT(*)` over the lead log, a
 * single erasure request would silently rewrite a merchant's conversion
 * history, and there is nothing to repair it from: the counters cannot be
 * recomputed (ADR 0019).
 *
 * So the metric wording changed rather than the storage: "Leads with an email"
 * is **conversions on Optins that capture an email** (ADR 0020). Same number,
 * different source — and the difference is invisible on screen, which is
 * exactly why it needs something that fails.
 *
 * ============================================================================
 * IT WALKS THE DEPENDENCIES RATHER THAN A LIST OF CLASSES.
 * ============================================================================
 * A list of "the reporting classes" is a list that goes stale the first time
 * one of them acquires a collaborator, and the collaborator is where the
 * derivation would arrive — nobody writes `SELECT COUNT(*) FROM wconvert_leads`
 * inside {@see \WConvert\Stats\Dashboard}. They inject a `LeadRepository`,
 * because it already has the method.
 *
 * So the closure below is computed: start at the route and the screen, follow
 * every WConvert class either of them names, and repeat. Adding a dependency
 * to the dashboard pulls that dependency into the scan on the same commit,
 * with nothing to remember.
 *
 * Tokenised rather than grepped, for the reason
 * {@see \WConvert\Tests\Unit\Lead\NoLeadIsEverUpdatedTest} gives at length:
 * the reporting classes DISCUSS this rule in prose — the paragraph above is in
 * two of their docblocks — and a check that flags the explanation for a rule
 * earns an exception list, which is the one thing it must never acquire.
 */
#[CoversNothing]
final class NoCountComesFromTheLeadLogTest extends TestCase
{
    /**
     * Where a reported number comes from: the route that serves the screen,
     * and the two classes that produce its arithmetic.
     *
     * Roots rather than the whole list — everything else in the scan is
     * reached from these.
     */
    private const ROOTS = [
        'WConvert\\Rest\\DashboardController',
        'WConvert\\Stats\\Dashboard',
        'WConvert\\Goal\\GoalReport',
    ];

    /** The two ways the lead log gets named, as {@see \WConvert\Tests\Unit\Lead\NoLeadIsEverUpdatedTest} has them. */
    private const LEAD_TABLE = ['TABLE_LEADS', 'wconvert_leads'];

    /** The namespace a reporting path must not reach into at all. */
    private const LEAD_NAMESPACE = 'WConvert\\Lead\\';

    private static function root(): string
    {
        return dirname(__DIR__, 3);
    }

    /** The file a WConvert class lives in, or null where it is not one of ours. */
    private static function fileFor(string $class): ?string
    {
        $path = match (true) {
            str_starts_with($class, 'WConvert\\Pro\\') => '/pro/src/' . substr($class, strlen('WConvert\\Pro\\')),
            str_starts_with($class, 'WConvert\\') => '/src/' . substr($class, strlen('WConvert\\')),
            default => null,
        };

        if ($path === null) {
            return null;
        }

        $file = self::root() . str_replace('\\', '/', $path) . '.php';

        return is_file($file) ? $file : null;
    }

    /**
     * One file's tokens, with whitespace and every comment dropped.
     *
     * @return list<array{0: int, 1: string, 2: int}|string>
     */
    private static function codeOf(string $file): array
    {
        return array_values(array_filter(
            token_get_all((string) file_get_contents($file)),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));
    }

    /**
     * Every WConvert class this file's CODE names.
     *
     * Three spellings resolve: an import, a fully-qualified name, and a bare
     * one in the file's own namespace. Each is confirmed by the file it would
     * live in existing, so a method or a variable that happens to share a
     * class's spelling resolves to nothing.
     *
     * A false edge would only WIDEN the closure, which makes this stricter
     * rather than weaker.
     *
     * @return list<string>
     */
    private static function dependenciesOf(string $file): array
    {
        $tokens = self::codeOf($file);
        $namespace = '';
        $candidates = [];

        foreach ($tokens as $index => $token) {
            if (!is_array($token)) {
                continue;
            }

            if ($token[0] === T_NAMESPACE) {
                $namespace = self::nameAt($tokens, $index + 1);

                continue;
            }

            if ($token[0] === T_USE) {
                $candidates[] = self::nameAt($tokens, $index + 1);

                continue;
            }

            if ($token[0] === T_NAME_FULLY_QUALIFIED || $token[0] === T_NAME_QUALIFIED) {
                $candidates[] = ltrim($token[1], '\\');

                continue;
            }

            if ($token[0] === T_STRING) {
                // A bare name, which in this codebase is a class in the file's
                // own namespace far more often than anything else.
                $candidates[] = $namespace === '' ? $token[1] : $namespace . '\\' . $token[1];
            }
        }

        return array_values(array_unique(array_filter(
            $candidates,
            static fn (string $class): bool => self::fileFor($class) !== null
        )));
    }

    /**
     * The dotted name starting at `$index`, however PHP 8 tokenised it.
     *
     * @param list<array{0: int, 1: string, 2: int}|string> $tokens
     */
    private static function nameAt(array $tokens, int $index): string
    {
        $token = $tokens[$index] ?? null;

        return is_array($token) ? ltrim($token[1], '\\') : '';
    }

    /**
     * Every line on which a file's CODE names the lead log.
     *
     * **Declaring the constant is not naming the table.**
     * {@see \WConvert\Database\Connection} declares `TABLE_LEADS` and is in
     * every reporting path's closure, because it is the interface every read
     * goes through. Flagging the declaration would have made this test an
     * exception list on its first run. So a USE is `::TABLE_LEADS`, and a
     * `const TABLE_LEADS = 'wconvert_leads'` is the name being given rather
     * than being used.
     *
     * @return list<int>
     */
    private static function leadTableUsesIn(string $php): array
    {
        $tokens = array_values(array_filter(
            token_get_all($php),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        $found = [];

        foreach ($tokens as $index => $token) {
            if (!is_array($token)) {
                continue;
            }

            $previous = $tokens[$index - 1] ?? null;

            if (
                $token[0] === T_STRING
                && in_array($token[1], self::LEAD_TABLE, true)
                && is_array($previous)
                && $previous[0] === T_DOUBLE_COLON
            ) {
                $found[] = $token[2];

                continue;
            }

            if (
                $token[0] === T_CONSTANT_ENCAPSED_STRING
                && in_array(trim($token[1], '"\''), self::LEAD_TABLE, true)
                && !self::isConstantDeclaration($tokens, $index)
            ) {
                $found[] = $token[2];
            }
        }

        return $found;
    }

    /**
     * Is the literal at `$index` the value of a `const NAME = …` declaration?
     *
     * @param list<array{0: int, 1: string, 2: int}|string> $tokens
     */
    private static function isConstantDeclaration(array $tokens, int $index): bool
    {
        $equals = $tokens[$index - 1] ?? null;
        $name = $tokens[$index - 2] ?? null;
        $const = $tokens[$index - 3] ?? null;

        return $equals === '='
            && is_array($name)
            && $name[0] === T_STRING
            && is_array($const)
            && $const[0] === T_CONST;
    }

    /**
     * Every WConvert class a reported number can be produced by.
     *
     * @return list<string>
     */
    private static function reportingClosure(): array
    {
        $seen = [];
        $queue = self::ROOTS;

        while ($queue !== []) {
            $class = array_shift($queue);

            if (isset($seen[$class])) {
                continue;
            }

            $file = self::fileFor($class);

            if ($file === null) {
                continue;
            }

            $seen[$class] = true;

            foreach (self::dependenciesOf($file) as $dependency) {
                if (!isset($seen[$dependency])) {
                    $queue[] = $dependency;
                }
            }
        }

        $classes = array_keys($seen);

        sort($classes);

        return $classes;
    }

    /**
     * **The claim.** Every class a reported number can come from, and not one
     * of them reads the lead log.
     */
    public function testNoClassThatProducesAReportedNumberNamesTheLeadLog(): void
    {
        $offenders = [];

        foreach (self::reportingClosure() as $class) {
            $file = (string) self::fileFor($class);

            foreach (self::leadTableUsesIn((string) file_get_contents($file)) as $line) {
                $offenders[] = $class . ':' . $line;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'ADR 0020: never join wconvert_leads to produce a count. ADR 0018 deletes those rows on erasure, '
                . 'so a metric read from them lets one erasure request rewrite a merchant\'s history.'
        );
    }

    /**
     * **And no reporting path reaches into the [[Lead]] namespace at all.**
     *
     * The table check catches the query somebody writes. This catches the
     * shape it would actually arrive in — a `LeadRepository` injected into a
     * report, whose `submissions()` already returns the number, spelled
     * nowhere near the word `wconvert_leads`.
     */
    public function testNoReportingPathReachesIntoTheLeadNamespace(): void
    {
        $reached = array_values(array_filter(
            self::reportingClosure(),
            static fn (string $class): bool => str_starts_with($class, self::LEAD_NAMESPACE)
        ));

        $this->assertSame(
            [],
            $reached,
            'a reporting path that can reach a Lead is one edit away from counting one (ADR 0020)'
        );
    }

    /**
     * The closure is real. An empty scan is a tree this check cannot speak
     * for, not a clean one — the same fail-closed posture the source contract
     * takes (ADR 0029), and the reason the roots are asserted to be IN it
     * rather than merely not to have failed.
     */
    public function testTheClosureActuallyReachesTheClassesItClaimsTo(): void
    {
        $closure = self::reportingClosure();

        foreach (self::ROOTS as $root) {
            $this->assertContains($root, $closure);
        }

        // The counters, the Optins that interpret them and the one interface
        // every read goes through. If a refactor ever stops the walk reaching
        // these, it has stopped reaching everything behind them too.
        foreach (
            [
                'WConvert\\Stats\\StatsRepository',
                'WConvert\\Optin\\OptinRepository',
                'WConvert\\Database\\Connection',
                'WConvert\\Goal\\Goal',
            ] as $expected
        ) {
            $this->assertContains($expected, $closure, 'the walk reaches the classes a count is actually made of');
        }
    }

    /**
     * The scanner can fail — a guard that cannot is a comment with a green
     * tick beside it. This is the derivation ADR 0018 depends on not existing,
     * written out.
     */
    public function testTheScannerCatchesACountTakenFromTheLeadLog(): void
    {
        $offending = <<<'PHP'
        <?php
        $row = $this->db->row(Connection::TABLE_LEADS, 'SELECT COUNT(*) AS total FROM %i WHERE optin_id = %s', $id);
        PHP;

        $this->assertSame([2], self::leadTableUsesIn($offending));
    }

    /**
     * And the same query with the table spelled out, which is what a script
     * with a live `$wpdb` in scope reaches for first.
     */
    public function testTheScannerCatchesTheTableNamedAsAString(): void
    {
        $offending = <<<'PHP'
        <?php
        $total = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}" . 'wconvert_leads');
        PHP;

        $this->assertSame([2], self::leadTableUsesIn($offending));
    }

    /**
     * **The declaration is not a use**, which is the distinction that keeps
     * this test from needing an exception for the one interface every read in
     * the codebase goes through.
     */
    public function testTheScannerIgnoresTheInterfaceDeclaringTheConstant(): void
    {
        $legitimate = <<<'PHP'
        <?php
        interface Connection
        {
            public const TABLE_LEADS = 'wconvert_leads';
        }
        PHP;

        $this->assertSame([], self::leadTableUsesIn($legitimate));
    }

    /**
     * Prose about the rule is not a breach of it. Two of the classes in the
     * closure explain at length why a count never comes from this table, and
     * every one of those sentences names it.
     */
    public function testTheScannerIgnoresTheRuleBeingDiscussedInAComment(): void
    {
        $documented = <<<'PHP'
        <?php
        /** Never a count from Connection::TABLE_LEADS — ADR 0018 deletes those rows. */
        // and never from 'wconvert_leads' spelled out either.
        $rows = $this->db->results(Connection::TABLE_STATS, self::IN_RANGE, $from, $to);
        PHP;

        $this->assertSame([], self::leadTableUsesIn($documented));
    }
}
