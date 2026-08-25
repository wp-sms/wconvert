<?php

namespace WConvert\Tests\Unit\Goal;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Availability;

/**
 * The three states, and the one rule that orders them.
 *
 * Availability names **why** a registry member is absent, never how it
 * renders: `ready` is present and usable, `locked` is absent because the
 * install has no [[Pro]], and `unavailable` is absent because something the
 * *site* would need is missing — no WooCommerce, no WSMS (CONTEXT.md,
 * Availability).
 *
 * **Where both reasons apply, `unavailable` wins.** That is the whole of the
 * arithmetic and it is the reason this is a function rather than two booleans
 * every surface re-combines: a merchant with no store is never sold Pro for a
 * feature Pro would not give them, and collapsing the two into "not available"
 * is exactly what shows a paying customer an advertisement for Pro
 * (ADR 0026).
 */
#[CoversClass(Availability::class)]
final class AvailabilityTest extends TestCase
{
    public function testAMemberTheInstallHasIsReady(): void
    {
        $this->assertSame(Availability::Ready, Availability::of(true, true));
    }

    public function testAMemberOnlyProSuppliesIsLocked(): void
    {
        $this->assertSame(Availability::Locked, Availability::of(true, false));
    }

    public function testAMemberTheSiteCannotServeIsUnavailable(): void
    {
        $this->assertSame(Availability::Unavailable, Availability::of(false, true));
    }

    /**
     * The precedence, and the only case that needed a decision. You can buy a
     * licence from us; you cannot buy WooCommerce from us (ADR 0026).
     */
    public function testWhereBothReasonsApplyUnavailableWins(): void
    {
        $this->assertSame(Availability::Unavailable, Availability::of(false, false));
    }
}
