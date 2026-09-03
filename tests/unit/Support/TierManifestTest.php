<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Support\Tier;
use WConvert\Support\TierManifest;

/**
 * =============================================================================
 * THE LADDER IS SPELLED TWICE ON PURPOSE, AND THIS IS WHAT STOPS IT DRIFTING.
 * =============================================================================
 * The ORDER lives in {@see Tier::ladder()}, in code; the DISPLAY NAMES and the
 * MODULE SETS live in `tiers.json`, in data. That split is deliberate and
 * ADR 0015 records the reason as somebody else's bug: WSMS's shipped elite ZIP
 * is missing the `tiers.json` its own `TierGate` reads, benign only because
 * every lookup fails open — "and a ladder that fails open is not a ladder".
 * {@see Tier::includes()} reads no file, so the ordering cannot fail open
 * however badly a build goes wrong.
 *
 * The price of two spellings is that they can disagree, and a disagreement here
 * is not cosmetic: `bin/tier-manifest.php` takes the ORDER from the file (it
 * runs against a staged tree, where the plugin cannot be booted), while every
 * running install takes it from the enum. A file listing `elite` before `pro`
 * would give the release build and the merchant's screen two different ladders.
 *
 * So this asserts the two agree, and it asserts it against the SHIPPED file
 * rather than a fixture — the same reason `tests/js/support/rule-types.ts`
 * reads the real rule manifest.
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

    /**
     * @param array<string, list<string>> $modulesByTier
     */
    private static function ladder(array $modulesByTier, string $name = 'Pro'): TierManifest
    {
        return TierManifest::fromArray([
            'premium' => [
                'tiers' => array_map(
                    static fn (string $slug, array $modules): array => [
                        'slug' => $slug,
                        'name' => $name,
                        'modules' => $modules,
                    ],
                    array_keys($modulesByTier),
                    array_values($modulesByTier)
                ),
            ],
        ]);
    }

    // =========================================================================
    // The two spellings of the ladder.
    // =========================================================================

    public function testTheShippedFileDeclaresTheSameRungsInTheSameOrderAsTheEnum(): void
    {
        $this->assertSame(
            array_map(static fn (Tier $tier): string => $tier->value, Tier::paid()),
            self::shipped()->declaredSlugs(),
            'tiers.json and WConvert\\Support\\Tier disagree about the ladder'
        );
    }

    /** Free is not a rung of Pro. A free install is the whole product minus features it never carried. */
    public function testTheFileDeclaresNoFreeTier(): void
    {
        $this->assertNotContains(Tier::Free->value, self::shipped()->declaredSlugs());
    }

    /**
     * ONE PRODUCT IS SOLD, AND THREE ARE UNDERSTOOD.
     *
     * Every paid rung displays as "Pro" at launch, which is the whole point of
     * putting the name in data: splitting the range later is an edit to
     * `tiers.json` rather than a code change and a data migration (ADR 0056).
     * A rung that started displaying its own slug would be this product
     * announcing a tier nobody can buy.
     */
    public function testEveryPaidRungDisplaysAsProAtLaunch(): void
    {
        foreach (Tier::paid() as $tier) {
            $this->assertSame('Pro', self::shipped()->displayName($tier), $tier->value . ' displays as something else');
        }
    }

    /**
     * A rung the file does not name falls back to its slug — visibly odd on
     * screen, which is the right failure for copy nobody can read, and better
     * than an empty string that renders as *"Upgrade to  to unlock this"*.
     */
    public function testATierTheFileDoesNotNameDisplaysAsItsOwnSlug(): void
    {
        $this->assertSame('elite', self::ladder(['basic' => ['a']])->displayName(Tier::Elite));
    }

    // =========================================================================
    // Which modules a rung ships, and what a rung is inferred to be.
    // =========================================================================

    /**
     * **Every rung names its modules, including the top one.**
     *
     * There is no `"*"`, and the reason is that the artifact contract asserts
     * two things — that a rung carries no module it does not declare, and that
     * it carries every module it does. Against a wildcard the second half
     * asserts nothing, which would leave the rung every customer buys today as
     * the one rung with no completeness check (ADR 0056).
     */
    public function testEveryRungNamesItsOwnModulesRatherThanClaimingEverything(): void
    {
        foreach (Tier::paid() as $tier) {
            $this->assertNotSame([], self::shipped()->modulesAt($tier), $tier->value . ' names no module');
        }
    }

    /** Higher rungs ship everything lower ones do, which is what makes the ladder a ladder. */
    public function testAHigherRungShipsEveryModuleALowerOneDoes(): void
    {
        $manifest = self::shipped();

        foreach (Tier::paid() as $lower) {
            foreach (Tier::paid() as $higher) {
                if (!$higher->includes($lower)) {
                    continue;
                }

                foreach ($manifest->modulesAt($lower) as $module) {
                    $this->assertTrue(
                        $manifest->shipsModule($higher, $module),
                        sprintf('%s ships %s and %s above it does not', $lower->value, $module, $higher->value)
                    );
                }
            }
        }
    }

    /**
     * ========================================================================
     * THE INSTALLED TIER IS INFERRED, AND THE INFERENCE IS THE HIGHEST FLOOR.
     * ========================================================================
     * Each module is evidence of at least the rung that first ships it; the
     * build is the highest such rung. That is what makes it spoof-resistant
     * downward — claiming a lower tier costs you the modules — and it is what
     * WP Statistics' `TierGate::installedTier()` does, chosen over a stored
     * label because a label is a thing to migrate and a directory is not.
     */
    public function testABuildIsTheHighestRungItsModulesImply(): void
    {
        $manifest = self::ladder([
            'basic' => ['designs'],
            'pro' => ['designs', 'triggers'],
            'elite' => ['designs', 'triggers', 'carts'],
        ]);

        $this->assertSame(Tier::Basic, $manifest->tierFor(['designs']));
        $this->assertSame(Tier::Pro, $manifest->tierFor(['designs', 'triggers']));
        $this->assertSame(Tier::Elite, $manifest->tierFor(['designs', 'triggers', 'carts']));
    }

    /** Order is not evidence: the set decides, so an unpacker's listing cannot. */
    public function testTheOrderTheModulesArriveInDoesNotDecideTheRung(): void
    {
        $manifest = self::ladder([
            'basic' => ['designs'],
            'pro' => ['designs', 'triggers'],
            'elite' => ['designs', 'triggers', 'carts'],
        ]);

        $this->assertSame(Tier::Elite, $manifest->tierFor(['carts', 'designs']));
        $this->assertSame(Tier::Elite, $manifest->tierFor(['designs', 'carts']));
    }

    /**
     * ========================================================================
     * AND EVERY UNREADABLE STATE RESOLVES DOWNWARD, NEVER OPEN.
     * ========================================================================
     * No file, no modules, or modules nothing claims: a loaded Pro reads as the
     * BOTTOM paid rung. Reading it as free would show a paying customer upsell
     * cards for what they bought (ADR 0026); reading it as elite would offer
     * them a feature their ZIP does not contain. The bottom rung is the only
     * answer wrong in the recoverable direction.
     *
     * The contrast is the point: WSMS's every lookup fails OPEN, which ADR 0015
     * records as the reason its own ladder is not one.
     */
    public function testAnUnreadableLadderResolvesToTheBottomRungAndNotTheTop(): void
    {
        $noFile = TierManifest::fromArray([]);

        $this->assertSame(Tier::Basic, $noFile->tierFor(['designs', 'triggers', 'carts']));
        $this->assertSame(Tier::Basic, $noFile->tierFor([]));
    }

    public function testAModuleNoRungClaimsIsEvidenceOfNothing(): void
    {
        $manifest = self::ladder(['basic' => ['designs'], 'pro' => ['designs', 'triggers']]);

        $this->assertSame(Tier::Basic, $manifest->tierFor(['something-nobody-declared']));
        $this->assertNull($manifest->lowestTierSupplying('something-nobody-declared'));
    }

    /** A build with nothing in it is still not read as the top rung. */
    public function testAnEmptyModuleSetIsTheBottomRung(): void
    {
        $this->assertSame(Tier::Basic, self::shipped()->tierFor([]));
    }

    // =========================================================================
    // The ladder's own arithmetic.
    // =========================================================================

    /**
     * **Free is included by every rung**, which is what makes a paid install
     * the whole product rather than a different one (CONTEXT.md, Pro).
     */
    public function testEveryRungIncludesFree(): void
    {
        foreach (Tier::cases() as $tier) {
            $this->assertTrue($tier->includes(Tier::Free), $tier->value . ' does not include free');
        }
    }

    public function testARungIncludesItselfAndEverythingBelowAndNothingAbove(): void
    {
        $this->assertTrue(Tier::Pro->includes(Tier::Pro));
        $this->assertTrue(Tier::Pro->includes(Tier::Basic));
        $this->assertFalse(Tier::Pro->includes(Tier::Elite));
        $this->assertFalse(Tier::Basic->includes(Tier::Pro));
        $this->assertFalse(Tier::Free->includes(Tier::Basic));
    }

    /**
     * `isSuppliedBy` is the one question every registry asks, and a free member
     * is supplied without anything being looked up at all — which is what keeps
     * a free install from depending on a file Pro would have written.
     */
    public function testAFreeMemberIsSuppliedOnAFreeInstallWithoutAskingTheLadder(): void
    {
        $this->assertTrue(Tier::Free->isSuppliedBy(new FakeProPresence()));
        $this->assertFalse(Tier::Basic->isSuppliedBy(new FakeProPresence()));
    }

    public function testAMemberIsSuppliedByItsOwnRungAndEveryRungAbove(): void
    {
        $this->assertFalse(Tier::Pro->isSuppliedBy(new FakeProPresence(Tier::Basic)));
        $this->assertTrue(Tier::Pro->isSuppliedBy(new FakeProPresence(Tier::Pro)));
        $this->assertTrue(Tier::Pro->isSuppliedBy(new FakeProPresence(Tier::Elite)));
    }
}
