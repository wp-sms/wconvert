<?php

namespace WConvert\Tests\Unit\Database;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Schema;

/**
 * The DDL, guarded on the two things about it that are decisions rather than
 * syntax.
 *
 * **The missing columns.** `wconvert_leads` has no `status` and no
 * `updated_at`, and their absence is the enforcement mechanism, not an
 * oversight (ADR 0002): a row with no mutable state cannot acquire a lifecycle
 * without a migration a reviewer will see. A comment cannot enforce that. This
 * can — and it is what turns "do not fix this" from a request into a failing
 * build.
 *
 * **The unaligned columns.** dbDelta splits each column line on whitespace, so
 * padding the type column into a neat block breaks its field-type parser —
 * WSMS's aligned DDL produced 142 false "changed type" diffs on a healthy
 * schema and forced a 324-line SchemaDoctor to undo the damage (ADR 0001). The
 * tidy-up that causes it is a one-keystroke reformat nobody would flag in
 * review, which is exactly why it is asserted here.
 */
#[CoversClass(Schema::class)]
final class SchemaTest extends TestCase
{
    private const PREFIX = 'wp_';

    private static function ddl(): string
    {
        return Schema::sql(self::PREFIX, 'DEFAULT CHARACTER SET utf8mb4');
    }

    /**
     * Every column line of one table, with the `CREATE TABLE`, the keys and
     * the closing line dropped.
     *
     * @return list<string>
     */
    private static function columnsOf(string $table): array
    {
        $ddl = self::ddl();
        $start = strpos($ddl, "CREATE TABLE {$table} (");

        self::assertNotFalse($start, "the DDL declares {$table}");

        $body = substr($ddl, $start);
        $body = substr($body, (int) strpos($body, "(\n") + 2);
        $body = substr($body, 0, (int) strpos($body, "\n)"));

        return array_values(array_filter(
            explode("\n", $body),
            static fn (string $line): bool => !str_starts_with($line, 'PRIMARY KEY')
                && !str_starts_with($line, 'KEY')
                && !str_starts_with($line, 'UNIQUE KEY')
        ));
    }

    /**
     * @return list<string>
     */
    private static function columnNamesOf(string $table): array
    {
        return array_map(
            static fn (string $line): string => strtok($line, ' ') ?: '',
            self::columnsOf($table)
        );
    }

    public function testTheLeadLogCarriesTheApprovedShapeAndNothingElse(): void
    {
        $this->assertSame(
            ['id', 'optin_id', 'email', 'phone', 'fields', 'created_at'],
            self::columnNamesOf(self::PREFIX . 'wconvert_leads')
        );
    }

    /**
     * The one assertion in this file that is a domain rule rather than a
     * shape. Any feature that wants to give a Lead a lifecycle is the signal
     * WConvert is drifting into being a second contact database
     * (CONTEXT.md, Lead), and these two columns are where that arrives.
     */
    public function testALeadHasNoMutableState(): void
    {
        $columns = self::columnNamesOf(self::PREFIX . 'wconvert_leads');

        $this->assertNotContains('status', $columns, 'ADR 0002: a Lead has no lifecycle to hold a status');
        $this->assertNotContains('updated_at', $columns, 'ADR 0002: a Lead is never updated, so nothing stamps one');
    }

    /**
     * The identity keys are real indexed columns because grouping the log
     * pivots on them, and WSMS's `ContactRepository::create()` hard-requires
     * one of the two (ADR 0002). Everything else the Optin captured goes in
     * one `fields` JSON.
     */
    public function testTheIdentityKeysAreIndexedAndEverythingElseIsOneJsonColumn(): void
    {
        $ddl = self::ddl();

        $this->assertStringContainsString('KEY idx_email (email)', $ddl);
        $this->assertStringContainsString('KEY idx_phone (phone)', $ddl);
        $this->assertStringContainsString('fields LONGTEXT', $ddl);
    }

    /**
     * **Never unique.** Leads are never deduplicated — one person submitting
     * two forms did two things and produces two rows (ADR 0021) — so a UNIQUE
     * index on either identity key would make the second submission fail at
     * the database. WSMS's `wsms_contacts` does declare them unique, correctly,
     * because a [[Contact]] is an entity and a Lead is an event.
     */
    public function testTheIdentityKeyIndexesAreNotUnique(): void
    {
        $this->assertStringNotContainsString('UNIQUE', self::ddl());
    }

    public function testEveryColumnLineIsUnalignedSoDbDeltaCanParseIt(): void
    {
        foreach ([self::PREFIX . 'wconvert_optins', self::PREFIX . 'wconvert_leads'] as $table) {
            foreach (self::columnsOf($table) as $line) {
                $this->assertDoesNotMatchRegularExpression(
                    '/\s{2,}/',
                    $line,
                    sprintf('ADR 0001: dbDelta splits on whitespace, so "%s" must not be padded', $line)
                );
            }
        }
    }

    /**
     * dbDelta's own documentation requires exactly this spelling, two spaces
     * and all. It is the one place in the DDL where the padding is load-bearing.
     */
    public function testThePrimaryKeyKeepsItsTwoSpaces(): void
    {
        $this->assertSame(2, substr_count(self::ddl(), 'PRIMARY KEY  ('));
    }
}
