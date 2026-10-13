<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Support\Tier;
use WConvert\Support\TierManifest;

/**
 * =============================================================================
 * THE TIERS ARE SPELLED TWICE ON PURPOSE, AND THIS IS WHAT STOPS THEM DRIFTING.
 * =============================================================================
 * The tiers live in {@see Tier}, in code; the DISPLAY NAMES and the MODULE SET
 * live in `tiers.json`, in data. ADR 0015 records the reason as somebody else's
 * bug: WSMS's shipped elite ZIP is missing the `tiers.json` its own `TierGate`
 * reads, benign only because every lookup fails open. {@see Tier::includes()}
 * reads no file, so it cannot fail open however badly a build goes wrong.
 *
 * `bin/tier-manifest.php` reads the file (it runs against a staged tree, where
 * the plugin cannot be booted) while every running install reads the enum, so
 * this asserts the two agree — against the SHIPPED file rather than a fixture.
 */
#[CoversClass(TierManifest::class)]
#[CoversClass(Tier::class)]
final class TierManifestTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function shipped(): TierManifest
    {
        return TierManifest::load(self::PLUGIN_DIR);
    }

    // =========================================================================
    // The two spellings.
    // =========================================================================

    /** Free and one Pro (ADR 0146). A Nexus plan is a site count, not a tier. */
    public function testTheTiersAreFreeAndPro(): void
    {
        $this->assertSame([Tier::Free, Tier::Pro], Tier::cases());
        $this->assertSame([Tier::Free, Tier::Pro], Tier::ladder());
        $this->assertSame([Tier::Pro], Tier::paid());
    }

    public function testTheShippedFileDeclaresTheSamePaidTierAsTheEnum(): void
    {
        $this->assertSame(
            array_map(static fn (Tier $tier): string => $tier->value, Tier::paid()),
            self::shipped()->declaredSlugs(),
            'tiers.json and WConvert\\Support\\Tier disagree about the paid tiers'
        );
    }

    public function testProDisplaysAsPro(): void
    {
        $this->assertSame('Pro', self::shipped()->displayName(Tier::Pro));
        $this->assertSame('WConvert Pro', self::shipped()->productName(Tier::Pro));
    }

    /**
     * A tier the file does not name falls back to its slug — visibly odd on
     * screen, which is the right failure for copy nobody can read, and better
     * than an empty string that renders as *"Upgrade to  to unlock this"*.
     */
    public function testATierTheFileDoesNotNameDisplaysAsItsOwnSlug(): void
    {
        $this->assertSame('pro', TierManifest::fromArray([])->displayName(Tier::Pro));
    }

    // =========================================================================
    // Which modules Pro ships.
    // =========================================================================

    /**
     * **Pro names every module there is, and claims none with a wildcard.**
     *
     * The artifact contract asserts the Pro ZIP carries exactly the modules the
     * file names, so a module directory the file forgets would fail the
     * release — this catches it on the pull request instead.
     */
    public function testProShipsEveryModuleDirectory(): void
    {
        $onDisk = array_map(
            static fn (string $manifest): string => basename(dirname($manifest)),
            glob(self::PLUGIN_DIR . '/pro/modules/*/module.json') ?: []
        );
        sort($onDisk);

        $declared = self::shipped()->modulesAt(Tier::Pro);
        sort($declared);

        $this->assertNotSame([], $declared);
        $this->assertSame($onDisk, $declared);
    }

    public function testAModuleNoTierClaimsIsShippedByNothing(): void
    {
        $this->assertNull(self::shipped()->tierThatShips('something-nobody-declared'));
        $this->assertSame(Tier::Pro, self::shipped()->tierThatShips('ab-testing'));
    }

    // =========================================================================
    // The arithmetic.
    // =========================================================================

    /**
     * **Free is included by every tier**, which is what makes a Pro install
     * the whole product rather than a different one (CONTEXT.md, Pro).
     */
    public function testEveryTierIncludesFree(): void
    {
        foreach (Tier::cases() as $tier) {
            $this->assertTrue($tier->includes(Tier::Free), $tier->value . ' does not include free');
        }
    }

    public function testFreeDoesNotIncludePro(): void
    {
        $this->assertTrue(Tier::Pro->includes(Tier::Pro));
        $this->assertFalse(Tier::Free->includes(Tier::Pro));
    }

    /**
     * `isSuppliedBy` is the one question every registry asks, and a free member
     * is supplied without anything being looked up at all.
     */
    public function testAMemberIsSuppliedOnlyByAnInstallThatHasItsTier(): void
    {
        $this->assertTrue(Tier::Free->isSuppliedBy(new FakeProPresence()));
        $this->assertFalse(Tier::Pro->isSuppliedBy(new FakeProPresence()));
        $this->assertTrue(Tier::Free->isSuppliedBy(new FakeProPresence(Tier::Pro)));
        $this->assertTrue(Tier::Pro->isSuppliedBy(new FakeProPresence(Tier::Pro)));
    }
}
