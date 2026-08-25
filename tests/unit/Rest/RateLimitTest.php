<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rest\RateLimit;
use WConvert\Tests\Unit\Support\FakeTransientStore;

/**
 * The beacon's rate limit, and the promise it is really making.
 *
 * ============================================================================
 * THE IP IS NEVER STORED. NOT IN THE KEY, NOT IN THE VALUE, NOT ANYWHERE.
 * ============================================================================
 * That is an acceptance criterion rather than an implementation detail, and it
 * is the reason this class exists in the shape it does. ADR 0006 cut IP geo,
 * which removed the only rule that wanted an IP at all; storing one here would
 * put a network identifier into WConvert's storage, with retention and
 * subject-access obligations attached, for a value nothing queries.
 *
 * {@see self::testTheAddressAppearsNowhereInWhatWasStored()} is the assertion
 * that holds it — it reads everything the store was handed, keys included, and
 * looks for the address.
 */
#[CoversClass(RateLimit::class)]
final class RateLimitTest extends TestCase
{
    private const IP = '203.0.113.42';

    private const OTHER_IP = '198.51.100.7';

    /**
     * {@see RateLimit}'s own numbers, restated rather than imported.
     *
     * A test that read the constants would assert the code agrees with itself.
     * These are the values the reasoning in that file argues FOR — three hundred
     * a minute, sized so legitimate traffic cannot reach it — so changing either
     * should fail here and make somebody re-read the argument.
     */
    private const ALLOWED = 300;

    private const WINDOW = 60;

    /** A fixed instant. The clock is an argument, so a test can simply name one. */
    private const NOW = 1_700_000_000;

    private FakeTransientStore $transients;

    private RateLimit $limit;

    protected function setUp(): void
    {
        $this->transients = new FakeTransientStore();
        $this->limit = new RateLimit($this->transients);
    }

    /** Spend `$times` of one address's allowance at one moment. */
    private function knock(string $ip, int $times, int $now = self::NOW): void
    {
        for ($i = 0; $i < $times; $i++) {
            $this->limit->allows($ip, $now);
        }
    }

    public function testTheFirstRequestIsAllowed(): void
    {
        $this->assertTrue($this->limit->allows(self::IP, self::NOW));
    }

    public function testAVisitorsWholePageViewFitsInsideTheWindow(): void
    {
        // An Impression sends immediately and the rest coalesce on `pagehide`,
        // so a page view is two requests. Thirty page views in a minute from
        // one address is already a whole office behind one NAT.
        for ($i = 0; $i < self::ALLOWED; $i++) {
            $this->assertTrue($this->limit->allows(self::IP, self::NOW), "request {$i} is within the allowance");
        }
    }

    public function testTheRequestPastTheAllowanceIsRefused(): void
    {
        $this->knock(self::IP, self::ALLOWED);

        $this->assertFalse($this->limit->allows(self::IP, self::NOW));
    }

    /**
     * **A refused request still counts.** A caller who keeps knocking does not
     * get a quieter window for it, which is what stops the limit becoming a
     * throttle that resets itself.
     */
    public function testKnockingDuringARefusalDoesNotReopenTheWindow(): void
    {
        $this->knock(self::IP, self::ALLOWED + 10);

        $this->assertFalse(
            $this->limit->allows(self::IP, self::NOW + self::WINDOW - 1),
            'still inside the window it opened'
        );
    }

    public function testTheAllowanceComesBackWhenTheWindowLapses(): void
    {
        $this->knock(self::IP, self::ALLOWED + 1);
        $this->transients->now += self::WINDOW;

        $this->assertTrue($this->limit->allows(self::IP, self::NOW + self::WINDOW));
    }

    /**
     * **And it comes back on an install where nothing swept the transient.**
     *
     * An object-cache-backed transient can hand a value back past its expiry —
     * an expiry is a hint to the cache, not a promise to the caller. So the
     * window is decided by the stamp INSIDE the bucket rather than by the
     * bucket still being there, and this is the test that says the difference
     * matters: with sweeping off, the value is still returned and the caller
     * must still be let through.
     */
    public function testALapsedWindowReopensEvenWhereNothingSweptTheTransient(): void
    {
        $this->transients->sweeps = false;

        $this->knock(self::IP, self::ALLOWED + 1);

        $this->assertFalse($this->limit->allows(self::IP, self::NOW), 'spent, at the moment it was spent');
        $this->assertTrue(
            $this->limit->allows(self::IP, self::NOW + self::WINDOW),
            'and open again a window later, with the stale bucket still in the store'
        );
    }

    /**
     * One caller exhausting the limit must not silence anybody else, or a
     * single noisy address would take a merchant's whole day of numbers with
     * it.
     */
    public function testOneCallerCannotSpendAnothersAllowance(): void
    {
        $this->knock(self::IP, self::ALLOWED + 1);

        $this->assertFalse($this->limit->allows(self::IP, self::NOW));
        $this->assertTrue($this->limit->allows(self::OTHER_IP, self::NOW));
    }

    /**
     * **The address appears nowhere in what was stored.**
     *
     * Keys and values both, because a key is stored too — `wp_hash()` is an
     * HMAC on the site's own salts, so the real key is neither reversible nor
     * correlatable across sites.
     */
    public function testTheAddressAppearsNowhereInWhatWasStored(): void
    {
        $this->limit->allows(self::IP, self::NOW);

        $stored = json_encode($this->transients->stored) . implode('', array_keys($this->transients->stored));

        $this->assertNotSame([], $this->transients->stored, 'something was stored, so the search means something');
        $this->assertStringNotContainsString(self::IP, (string) $stored);
        $this->assertStringNotContainsString('203.0.113', (string) $stored, 'not even a prefix of it');
    }

    /**
     * The key is DERIVED from the address, which is the other half of the same
     * claim: two addresses must not share a bucket, and one address must reach
     * the same bucket twice.
     */
    public function testTheKeyIsDerivedFromTheAddressAndIsStableForIt(): void
    {
        $this->limit->allows(self::IP, self::NOW);
        $first = array_keys($this->transients->stored);

        $this->limit->allows(self::IP, self::NOW);
        $this->assertSame($first, array_keys($this->transients->stored), 'the same address reaches the same bucket');

        $this->limit->allows(self::OTHER_IP, self::NOW);
        $this->assertCount(2, $this->transients->stored, 'a different address reaches a different one');
    }

    /**
     * An empty address is refused rather than bucketed with every other empty
     * one — a request with no `REMOTE_ADDR` is a misconfigured proxy or a CLI
     * caller, and there is nobody there to inconvenience.
     */
    public function testARequestWithNoAddressIsRefusedAndStoresNothing(): void
    {
        $this->assertFalse($this->limit->allows('', self::NOW));
        $this->assertSame([], $this->transients->stored);
    }

    /**
     * The window is a transient and it EXPIRES. A rate-limit bucket that
     * outlived its window would be an option with a worse name, which is what
     * {@see \WConvert\Storage\TransientStore}'s required expiry exists to
     * prevent.
     */
    public function testTheBucketIsWrittenWithAnExpiry(): void
    {
        $this->limit->allows(self::IP, self::NOW);

        $held = array_values($this->transients->stored)[0];

        $this->assertSame($this->transients->now + self::WINDOW, $held['expires']);
    }
}
