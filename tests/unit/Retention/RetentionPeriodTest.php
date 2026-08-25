<?php

namespace WConvert\Tests\Unit\Retention;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Retention\RetentionPeriod;
use WConvert\Support\Ulid;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * How long a merchant keeps their [[Lead]]s — and the default, which is
 * **forever**.
 *
 * Deleting a merchant's Leads because the plugin shipped an opinion is a
 * support catastrophe, and may destroy records they are required to keep for
 * reasons that have nothing to do with marketing (ADR 0018). So retention
 * ships as keep-forever with pruning off, and the job that would prune exists
 * from day one with nothing to do.
 *
 * A period lives in a WordPress option and not in a column: it is one integer
 * for the whole site, read once a day by a cron job and once per render by a
 * settings screen. That is the table-free alternative the database rule asks
 * to have considered, and it is the right one.
 */
#[CoversClass(RetentionPeriod::class)]
final class RetentionPeriodTest extends TestCase
{
    /** 2024-06-10 02:35:18.400 UTC, the millisecond `01J0000000…` encodes. */
    private const NOW_MS = 1717986918400;

    private const DAY_MS = 86400000;

    private FakeOptionStore $options;

    private RetentionPeriod $retention;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->retention = new RetentionPeriod($this->options);
    }

    public function testItShipsAsKeepForever(): void
    {
        $this->assertNull($this->retention->days());
        $this->assertNull($this->retention->boundary(self::NOW_MS));
    }

    public function testAConfiguredPeriodBecomesTheBoundaryThatManyDaysBack(): void
    {
        $this->retention->set(30);

        $boundary = $this->retention->boundary(self::NOW_MS);

        $this->assertNotNull($boundary);
        $this->assertSame(self::NOW_MS - (30 * self::DAY_MS), Ulid::timeOf($boundary));
    }

    /**
     * The boundary is a ULID, so the range it opens is one over the PRIMARY
     * KEY — which is what lets retention pruning need no index of its own
     * (ADR 0002, ADR 0018).
     */
    public function testTheBoundaryIsTheSmallestUlidOfItsMillisecond(): void
    {
        $this->retention->set(1);

        $boundary = (string) $this->retention->boundary(self::NOW_MS);

        $this->assertSame(Ulid::LENGTH, strlen($boundary));
        $this->assertSame(str_repeat('0', 16), substr($boundary, 10));
    }

    /**
     * **Turning it back off is keeping forever, not keeping zero days.** A
     * period of 0 read as "delete everything older than now" would empty the
     * log the first time the job ran after someone cleared the field.
     */
    public function testClearingThePeriodGoesBackToKeepForever(): void
    {
        $this->retention->set(30);
        $this->retention->set(null);

        $this->assertNull($this->retention->days());
        $this->assertNull($this->retention->boundary(self::NOW_MS));
    }

    public function testZeroAndNegativeDaysAreKeepForeverForTheSameReason(): void
    {
        $this->retention->set(0);
        $this->assertNull($this->retention->days());

        $this->retention->set(-5);
        $this->assertNull($this->retention->days());
    }

    /**
     * A period longer than the cap is not a period — it is keep-forever with
     * extra steps, and the honest setting for that is the one that says so.
     */
    public function testAPeriodBeyondTheCapIsClampedToIt(): void
    {
        $this->retention->set(RetentionPeriod::MAX_DAYS + 1);

        $this->assertSame(RetentionPeriod::MAX_DAYS, $this->retention->days());
    }

    /**
     * The option is written once per change and read once per use — never
     * autoloaded, like everything else WConvert stores (ADR 0003).
     */
    public function testItIsStoredInOneOption(): void
    {
        $this->retention->set(30);

        $this->assertSame(1, $this->options->writes);
        $this->assertSame(30, $this->options->get(RetentionPeriod::OPTION));
    }
}
