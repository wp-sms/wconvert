<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\FrontEndReadPath;
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
 * 2. **No licence value is read outside `pro/src/License/`, and none on any
 *    front-end request.** ADR 0015 permits two readers — Pro's updater and
 *    Pro's admin screens — and ADR 0143 puts both, and nothing else, in that
 *    one directory. Free reads none at all.
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

    /** The one directory licence code may live in (ADR 0143). */
    private const THE_LICENCE = 'pro/src/License/';

    /**
     * And the one file outside it that may name it: Pro's bootstrap — the same
     * file that states Pro is loaded — which runs the licence's provider beside
     * the capabilities' one.
     */
    private const THE_WIRING = self::THE_DEFINITION;

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
    private static function containing(array $relativePaths, string $needle, bool $anyCase = false): array
    {
        return array_values(array_filter(
            $relativePaths,
            static fn (string $path): bool => self::holds(PhpSource::code(self::ROOT . '/' . $path), $needle, $anyCase)
        ));
    }

    private static function holds(string $code, string $needle, bool $anyCase): bool
    {
        return $anyCase ? stripos($code, $needle) !== false : str_contains($code, $needle);
    }

    /**
     * @param list<string> $absolutePaths
     * @return list<string> Those whose CODE contains the needle, tree-relative.
     */
    private static function absoluteContaining(array $absolutePaths, string $needle, bool $anyCase = false): array
    {
        $root = (string) realpath(self::ROOT);

        return array_values(array_map(
            static fn (string $path): string => ltrim(str_replace($root, '', (string) realpath($path)), '/'),
            array_filter($absolutePaths, static fn (string $path): bool => self::holds(PhpSource::code($path), $needle, $anyCase))
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
     * NO LICENCE VALUE IS READ OUTSIDE `pro/src/License/`.
     * ========================================================================
     * ADR 0015 permits exactly two readers — Pro's updater and Pro's admin
     * screens — and ADR 0143 puts both in one directory. Until it did, this was
     * the total assertion: the word did not appear in code in either tree. It
     * is narrowed to that directory and the bootstrap line that runs it, and no
     * further, so a licence read anywhere else is still a decision somebody
     * has to come here and take on purpose rather than one that arrives inside
     * a feature branch.
     *
     * Case-insensitive, so `License\\` in a `use` line counts as a read: naming
     * the class is how a capability would start asking it.
     *
     * Comments are stripped first. Both trees explain at length why the
     * licence gates no feature, and the explanation must not read as the
     * violation.
     */
    public function testOnlyTheLicenceDirectoryReadsALicence(): void
    {
        $outside = array_values(array_filter(
            $this->shippedSources(),
            static fn (string $path): bool => !str_starts_with($path, self::THE_LICENCE)
        ));

        $this->assertNotEmpty(
            array_filter($this->shippedSources(), static fn (string $path): bool => str_starts_with($path, self::THE_LICENCE)),
            sprintf('%s holds no PHP — the allowance below now excuses nothing, so narrow it back', self::THE_LICENCE)
        );

        foreach (['licence', 'license', 'activation_key'] as $needle) {
            $this->assertSame(
                $needle === 'license' ? [self::THE_WIRING] : [],
                self::containing($outside, $needle, anyCase: true),
                sprintf('a licence value ("%s") read by shipped code outside %s', $needle, self::THE_LICENCE)
            );
        }
    }

    /**
     * And the bootstrap names the provider, nothing more: it runs the licence
     * and stops its daily check on deactivation; it does not ask it anything.
     */
    public function testTheBootstrapOnlyRunsTheLicenceProvider(): void
    {
        $code = PhpSource::code(self::ROOT . '/' . self::THE_WIRING);

        preg_match_all('/\\b\\w*licen[cs]e\\w*\\b/i', $code, $matches);

        $this->assertSame(
            ['License', 'LicenseServiceProvider'],
            array_values(array_unique($matches[0])),
            'Pro\'s bootstrap does more with the licence than run its provider'
        );
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
        // The same list `NoSecondCacheTest` scans for a second cache. One
        // list, because two hand-maintained ones drift and the drift is
        // silent — and it is where the "has this file been renamed out from
        // under the scan" guard lives.
        $files = FrontEndReadPath::files();

        foreach (['ProPresence', 'WCONVERT_PRO_LOADED', 'Tier::'] as $needle) {
            $this->assertSame(
                [],
                self::absoluteContaining($files, $needle),
                sprintf('an entitlement branch ("%s") on the front-end request path', $needle)
            );
        }

        // And nothing on the path so much as names the licence directory —
        // the narrowing above lets `pro/src/License/` read one, and this is
        // what keeps that allowance off every page view.
        foreach (['licence', 'license'] as $needle) {
            $this->assertSame(
                [],
                self::absoluteContaining($files, $needle, anyCase: true),
                sprintf('the front-end request path touches the licence ("%s")', $needle)
            );
        }
    }
}
