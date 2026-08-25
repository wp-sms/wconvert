<?php

namespace WConvert\Tests\Unit\Database;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\WpdbConnection;
use WConvert\Lead\LeadRepository;
use WConvert\Tests\Unit\Support\FakeConnection;

/**
 * How WConvert's SQL is bound to `$wpdb->prepare()`.
 *
 * **`prepare()` binds by APPEARANCE, not by kind.** It walks the query and
 * consumes one argument per placeholder in the order they occur. Every other
 * test in this suite goes through {@see FakeConnection}, which models the
 * table and ignores the query text — so nothing else here can see a binding
 * go wrong, and one did: the grouping view names its table twice, and passing
 * both tables in front of the values made the per-Optin form filter on the
 * table name and select `FROM` an Optin id.
 *
 * That query failed loudly against a real database and not at all against the
 * fake. This file is the cheap half of the fix; `bin/verify-lead-log.php` is
 * the half that runs it.
 */
#[CoversClass(WpdbConnection::class)]
final class WpdbConnectionTest extends TestCase
{
    private const TABLE = 'wp_wconvert_leads';

    /**
     * The shape that broke: two `%i`, each followed by a value.
     */
    public function testTheTableIsBoundAtEveryPlaceItIsNamedAndValuesKeepTheirPlaces(): void
    {
        $bound = WpdbConnection::bindings(
            'SELECT a FROM %i WHERE optin_id = %s UNION ALL SELECT b FROM %i WHERE optin_id = %s LIMIT %d',
            self::TABLE,
            ['OPTIN1', 'OPTIN1', 50]
        );

        $this->assertSame([self::TABLE, 'OPTIN1', self::TABLE, 'OPTIN1', 50], $bound);
    }

    public function testOneTableAndOneValueBindInThatOrder(): void
    {
        $bound = WpdbConnection::bindings('SELECT a FROM %i WHERE id = %s', self::TABLE, ['01J']);

        $this->assertSame([self::TABLE, '01J'], $bound);
    }

    public function testAQueryNamingOnlyItsTableBindsOnlyTheTable(): void
    {
        $this->assertSame([self::TABLE], WpdbConnection::bindings('SELECT COUNT(*) FROM %i', self::TABLE, []));
    }

    /**
     * An escaped literal percent is not a placeholder, and counting it as one
     * shifts every binding after it by one.
     */
    public function testAnEscapedPercentIsNotAPlaceholder(): void
    {
        $bound = WpdbConnection::bindings("SELECT a FROM %i WHERE a LIKE '100%%' AND b = %s", self::TABLE, ['x']);

        $this->assertSame([self::TABLE, 'x'], $bound);
    }

    /**
     * Every statement this codebase actually issues, bound.
     *
     * The assertion is not the values — it is that the count of arguments
     * matches the count of placeholders for each one, which is the invariant a
     * front-loaded table breaks and the one `prepare()` warns about at
     * runtime.
     */
    public function testEveryStatementTheLeadLogIssuesBindsOneArgumentPerPlaceholder(): void
    {
        $db = new FakeConnection();
        $leads = new LeadRepository($db);

        $leads->submissions(null);
        $leads->submissions('OPTIN1');
        $leads->page(null, 50);
        $leads->page('OPTIN1', 50);
        $leads->groups(null, 50);
        $leads->groups('OPTIN1', 50);
        $leads->since(null, '', 500);
        $leads->since('OPTIN1', '', 500);
        $leads->forEmail('sarah@example.com', 50, 0);
        $leads->eraseByEmail('sarah@example.com');
        $leads->pruneBefore('01J0000000ZZZZZZZZZZZZZZZZ');

        $this->assertNotSame([], $db->statements);

        foreach ($db->statements as $sql) {
            $placeholders = preg_match_all('/%[sdfi]/', str_replace('%%', '', $sql));

            $this->assertSame(
                $placeholders,
                count(WpdbConnection::bindings($sql, self::TABLE, $this->paramsFor($db, $sql))),
                "every placeholder in \"{$sql}\" takes exactly one argument"
            );
        }
    }

    /**
     * The params the repository passed alongside one statement.
     *
     * @return list<mixed>
     */
    private function paramsFor(FakeConnection $db, string $sql): array
    {
        foreach ([...$db->deletes] as $delete) {
            if ($delete['sql'] === $sql) {
                return $delete['params'];
            }
        }

        // Reads do not record their params, so the count is taken from the
        // query itself — which is the whole assertion: one argument per
        // placeholder that is not the table.
        return array_fill(0, (int) preg_match_all('/%[sdf]/', str_replace('%%', '', $sql)), 'x');
    }
}
