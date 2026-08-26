<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\PhpSource;

/**
 * =============================================================================
 * ENFORCEMENT IS BY NON-REGISTRATION (ADR 0015).
 * =============================================================================
 * There is **no runtime licence check anywhere in WConvert**. The only question
 * ever asked is "is [[Pro]] loaded", and it is answered by possession: a
 * premium capability is *absent* from a free install rather than present and
 * guarded. Possession gates features; the licence gates updates and support.
 * Once premium code is genuinely absent there is nothing left to guard, so
 * **not one premium feature needs an `if`**.
 *
 * Three things follow, and each is asserted below rather than described.
 *
 * 1. **One accessor, and one place the answer is looked up.** The interface is
 *    where the question is asked; exactly one file reads the constant.
 * 2. **No licence value is read on any front-end request.** Today the stronger
 *    statement holds — neither tree reads one anywhere — because Pro's updater
 *    and admin screens, the only things ADR 0015 permits to read it, do not
 *    exist yet.
 * 3. **The front-end path asks no tier question at all.** Not "is Pro loaded",
 *    not a licence, not anything: an entitlement branch on the request path is
 *    the exact thing ADR 0004 spends the whole loader design avoiding.
 *
 * WHY THIS READS SOURCE RATHER THAN BEHAVIOUR. What it guards against is a line
 * someone ADDS, and no assertion about output can see a rule that is currently
 * being kept. It is the same instrument `NoSecondCacheTest` is, pointed at the
 * other invariant the front-end path carries.
 *
 * WSMS's cautionary case, which ADR 0015 records: its shipped elite ZIP is
 * missing the `tiers.json` its own `TierGate` reads, benign only because every
 * lookup fails open — and a ladder that fails open is not a ladder. There is no
 * file to be missing here, and this is what keeps it that way.
 */
#[CoversNothing]
final class NoLicenceOnTheFrontEndTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../..';

    /** The one accessor's implementation — the only place the answer is looked up. */
    private const THE_ACCESSOR = 'src/Support/WpProPresence.php';

    /** Pro's bootstrap, the only place the answer is stated. */
    private const THE_DEFINITION = 'pro/src/Bootstrap.php';

    /**
     * Every PHP file that SHIPS, in both plugins.
     *
     * `tests/` and `bin/` are excluded because neither ships and this file is
     * itself full of the word it is scanning for. `src/` and `pro/src/` are
     * where both plugins' code lives.
     *
     * @return list<string> Tree-relative paths.
     */
    private function shippedSources(): array
    {
        $files = [];

        foreach (['src', 'pro/src'] as $tree) {
            $found = self::phpUnder(self::ROOT . '/' . $tree);

            $this->assertNotEmpty($found, sprintf('%s/ holds no PHP — nothing was inspected, so nothing is proven', $tree));

            $files = array_merge($files, $found);
        }

        return $files;
    }

    /** @return list<string> Tree-relative paths, sorted. */
    private static function phpUnder(string $directory): array
    {
        $files = [];
        $root = (string) realpath(self::ROOT);

        /** @var iterable<\SplFileInfo> $iterator */
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS));

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = ltrim(str_replace($root, '', (string) $file->getRealPath()), '/');
            }
        }

        sort($files);

        return $files;
    }

    /**
     * @param list<string> $relativePaths
     * @return list<string> Those whose CODE contains the needle.
     */
    private static function containing(array $relativePaths, string $needle): array
    {
        return array_values(array_filter(
            $relativePaths,
            static fn (string $path): bool => str_contains(PhpSource::code(self::ROOT . '/' . $path), $needle)
        ));
    }

    /**
     * ONE ACCESSOR, FROM DAY ONE.
     *
     * It exists as headroom for a future tier ladder, not as a gate. The fact
     * it reports is a `define()`, and a constant cannot be undefined again — so
     * the question is asked through an interface, and this is the assertion
     * that the interface has exactly one thing behind it. Two places reading
     * the constant is two places that can disagree about what "has Pro" means
     * the day a tier ladder arrives.
     */
    public function testExactlyOneFileLooksUpWhetherProIsLoaded(): void
    {
        $this->assertSame(
            [self::THE_ACCESSOR],
            self::containing($this->shippedSources(), "defined('WCONVERT_PRO_LOADED'"),
            'a second place that answers "is Pro loaded" for itself'
        );
    }

    /**
     * And exactly one states it — past Pro's min-core guard, so a Pro that
     * refused to boot reads exactly as a Pro that is not installed, which is
     * what the merchant is in fact getting.
     */
    public function testExactlyOneFileSaysThatProIsLoaded(): void
    {
        $this->assertSame(
            [self::THE_DEFINITION],
            self::containing($this->shippedSources(), "define('WCONVERT_PRO_LOADED'"),
            'a second place that claims Pro is loaded'
        );
    }

    /**
     * ========================================================================
     * NO LICENCE VALUE IS READ ANYWHERE THAT SHIPS.
     * ========================================================================
     * ADR 0015 permits exactly two readers — Pro's updater and Pro's admin
     * screens — and **neither exists yet**, so the assertion available today is
     * the total one: the word does not appear in code in either tree. When the
     * updater lands it will be the first hit, and whoever adds it will have to
     * come here and narrow this to the paths ADR 0015 names. That is the point:
     * a licence read is a decision, and this makes it one somebody takes on
     * purpose rather than one that arrives inside a feature branch.
     *
     * Comments are stripped first. Both trees explain at length why they hold
     * no licence check, and the explanation must not read as the violation.
     */
    public function testNoShippedFileReadsALicence(): void
    {
        foreach (['licence', 'license', 'activation_key', 'serial'] as $needle) {
            $this->assertSame(
                [],
                self::containing($this->shippedSources(), $needle),
                sprintf('a licence value ("%s") read by code that ships', $needle)
            );
        }
    }

    /**
     * ========================================================================
     * THE FRONT-END PATH ASKS NO TIER QUESTION AT ALL.
     * ========================================================================
     * Not a licence, and not "is Pro loaded" either. Free's enqueue does not
     * ask whether Pro is there — Pro dequeues free's loader after the fact
     * (ADR 0014) — and Pro's enqueue does not ask whether it is entitled,
     * because being in Pro's ZIP is the entitlement. That is what "not one
     * premium feature needs an `if`" means once it reaches the code.
     *
     * `ProPresence` itself is not front-end code and is not scanned here: it is
     * asked by the registries, to render an [[Availability]] as `locked` on an
     * admin screen, which is the one thing ADR 0015 says the accessor is for.
     */
    public function testTheFrontEndPathAsksNeitherALicenceNorATier(): void
    {
        $files = array_merge(
            self::phpUnder(self::ROOT . '/src/Frontend'),
            self::phpUnder(self::ROOT . '/pro/src/Frontend'),
            self::phpUnder(self::ROOT . '/src/Targeting'),
            ['src/Optin/PublishedOptin.php', 'src/Optin/PublishedSet.php', 'src/Assets/BuiltAsset.php'],
        );

        $this->assertGreaterThan(5, count($files), 'nothing was inspected, so nothing is proven');

        foreach (['ProPresence', 'WCONVERT_PRO_LOADED', 'Tier::'] as $needle) {
            $this->assertSame(
                [],
                self::containing($files, $needle),
                sprintf('an entitlement branch ("%s") on the front-end request path', $needle)
            );
        }
    }
}
