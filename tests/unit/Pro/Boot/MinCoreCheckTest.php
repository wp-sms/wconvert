<?php

namespace WConvert\Tests\Unit\Pro\Boot;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Boot\MinCoreCheck;
use WConvert\Pro\Boot\MinCoreVerdict;

/**
 * Pro's min-core boot guard, as a pure version comparison.
 *
 * ADR 0030 states the rule this implements: Pro's WCONVERT_MIN_CORE must be
 * ≤ the free version actually installed. Everything asserted here is read off
 * that "≤", not off the implementation.
 */
#[CoversClass(MinCoreCheck::class)]
final class MinCoreCheckTest extends TestCase
{
    public function testBootsWhenTheInstalledCoreIsExactlyTheMinimum(): void
    {
        $this->assertSame(
            MinCoreVerdict::Satisfied,
            MinCoreCheck::evaluate('1.4.0', '1.4.0')
        );
    }

    public function testRefusesToBootWhenTheInstalledCoreIsBelowTheMinimum(): void
    {
        $this->assertSame(
            MinCoreVerdict::CoreTooOld,
            MinCoreCheck::evaluate('1.3.9', '1.4.0')
        );
    }

    /**
     * 1.10.0 is above 1.9.0. A string comparison says the opposite, and it is
     * the comparison anyone reaching for `>=` writes by accident — so this
     * pair, not a plain 2.0.0, is what makes "above" worth asserting.
     */
    public function testBootsWhenTheInstalledCoreIsAboveTheMinimum(): void
    {
        $this->assertSame(
            MinCoreVerdict::Satisfied,
            MinCoreCheck::evaluate('1.10.0', '1.9.0')
        );
    }

    /**
     * Free absent is not free-too-old, and collapsing the two would put the
     * wrong instruction in front of the merchant: "update WConvert" is useless
     * advice to someone who does not have it installed.
     */
    public function testReportsCoreAbsentWhenFreeIsNotInstalledAtAll(): void
    {
        $this->assertSame(
            MinCoreVerdict::CoreAbsent,
            MinCoreCheck::evaluate(null, '1.4.0')
        );
    }

    /**
     * version_compare() never says "I cannot read this" — it ranks garbage
     * silently, and it does not always rank it low. PHP 8.5 evaluates
     * version_compare('99 bottles', '1.4.0', '>=') as TRUE, so a malformed
     * version left to version_compare alone lets Pro boot. Refusing on an
     * unreadable version is the fail-closed half of this guard, and this pair
     * is the case that proves the shape check is doing work rather than
     * decorating a comparison that was already correct.
     */
    public function testRefusesToBootWhenTheInstalledVersionIsUnreadable(): void
    {
        $this->assertSame(
            MinCoreVerdict::VersionUnreadable,
            MinCoreCheck::evaluate('99 bottles', '1.4.0')
        );
    }

    /**
     * The unreadable version can be Pro's OWN — a mistyped WCONVERT_MIN_CORE
     * is a packaging bug in Pro, and it must not resolve into a threshold that
     * silently admits or excludes installs. Fail closed on both sides.
     */
    public function testRefusesToBootWhenTheMinimumItselfIsUnreadable(): void
    {
        $this->assertSame(
            MinCoreVerdict::VersionUnreadable,
            MinCoreCheck::evaluate('1.4.0', 'next')
        );
    }

    /**
     * An unreadable version is not treated as an absent one. Both refuse the
     * boot, but they are different faults with different fixes, and a guard
     * that reported the wrong one would send the merchant to reinstall a
     * plugin that is sitting there working.
     */
    public function testAnUnreadableVersionIsNotReportedAsAnAbsentOne(): void
    {
        $this->assertNotSame(
            MinCoreVerdict::CoreAbsent,
            MinCoreCheck::evaluate('', '1.4.0')
        );
    }

    /**
     * Satisfied is the only verdict that boots, and every other case is a
     * refusal — including one added after this was written. A guard whose
     * default answer is "boot" is not a guard.
     */
    public function testOnlyTheSatisfiedVerdictPermitsABoot(): void
    {
        foreach (MinCoreVerdict::cases() as $verdict) {
            $this->assertSame(
                $verdict === MinCoreVerdict::Satisfied,
                $verdict->mayBoot(),
                sprintf('%s->mayBoot()', $verdict->name)
            );
        }
    }
}
