<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleVocabulary;

/**
 * `degraded_from` is spelled twice, so this is what says the two agree.
 *
 * The standing rule in this project is that anything spelled in TypeScript as
 * well as in PHP needs a test asserting the two agree — there are five such
 * tests already, and the fifth exists because #26 shipped a second spelling
 * with nothing asserting it ({@see \WConvert\Tests\Unit\Goal\GoalParityTest}).
 *
 * **It is spelled twice on purpose.** It is not a manifest param — declaring
 * it as one would draw a control in the builder and invite the merchant to
 * edit the record of a substitution — so there is no manifest between the two
 * sides to be the single source, exactly as there is none for
 * [[Availability]].
 *
 * **And the drift would be silent, which is why it is worth a file.**
 * {@see RuleVocabulary::normalize()} keeps this ONE key beyond a type's
 * declared params and drops everything else, so a builder writing the marker
 * under any other name would have it dropped on the way into `config` without
 * a word — and the persistent inline note ADR 0012 asks for would simply never
 * appear again, on any Optin, forever.
 */
#[CoversNothing]
final class DegradedMarkerParityTest extends TestCase
{
    private const BUILDER_API = __DIR__ . '/../../../resources/admin/src/builder/api.ts';

    /**
     * Read as TEXT rather than imported, because PHPUnit cannot run
     * TypeScript — the same instrument `GoalParityTest` points at the
     * Availability union.
     */
    public function testTheBuilderAndTheVocabularySpellTheMarkerTheSameWay(): void
    {
        $source = file_get_contents(self::BUILDER_API);

        $this->assertIsString($source, 'the builder API module is where the marker is declared');

        $matched = preg_match("/export const DEGRADED_FROM = '([a-z_]+)';/", $source, $found);

        $this->assertSame(1, $matched, 'the builder no longer declares the marker key in one place');
        $this->assertSame(RuleVocabulary::DEGRADED_FROM, $found[1]);
    }

    /**
     * And nothing else in the admin bundle spells it as a literal, which is
     * what keeps the declaration above the single place to change.
     */
    public function testTheMarkerIsSpelledOnceInTheAdminBundle(): void
    {
        $literal = sprintf("'%s'", RuleVocabulary::DEGRADED_FROM);
        $offenders = [];

        /** @var iterable<\SplFileInfo> $files */
        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(dirname(self::BUILDER_API, 2), \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($files as $file) {
            if (!$file->isFile() || $file->getRealPath() === realpath(self::BUILDER_API)) {
                continue;
            }

            if (str_contains((string) file_get_contents((string) $file->getRealPath()), $literal)) {
                $offenders[] = $file->getFilename();
            }
        }

        $this->assertSame([], $offenders, 'a second spelling of the degradation marker in the admin bundle');
    }
}
