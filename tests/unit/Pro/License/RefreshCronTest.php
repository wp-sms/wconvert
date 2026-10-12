<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\RefreshCron;

/**
 * The daily check asks the store only when there is a reason to: the renewal
 * window, an expiry, or an answer a week old.
 */
#[CoversClass(RefreshCron::class)]
final class RefreshCronTest extends TestCase
{
    use FakesNexus;

    private const NOW = 1_800_000_000;

    protected function setUp(): void
    {
        $this->fakeNexus();
    }

    protected function tearDown(): void
    {
        $this->stopFakingNexus();
        unset($GLOBALS['wconvertTestSchedule'][RefreshCron::HOOK]);
    }

    /** @return iterable<string, array{array<string, mixed>, bool}> */
    public static function licences(): iterable
    {
        $fresh = self::NOW - DAY_IN_SECONDS;

        yield 'a year left, checked yesterday' => [self::licence(365, $fresh), false];
        yield '17 days left' => [self::licence(17, $fresh), false];
        yield '16 days left — the renewal window opens' => [self::licence(16, $fresh), true];
        yield '1 day left' => [self::licence(1, $fresh), true];
        yield 'expired' => [self::licence(-3, $fresh), true];
        yield 'a year left, last answer 7 days ago' => [self::licence(365, self::NOW - 7 * DAY_IN_SECONDS), true];
        yield 'a year left, never answered' => [self::licence(365, null), true];
        yield 'lifetime, checked yesterday' => [['license_key' => 'k', 'expires_at' => '', 'last_success_at' => $fresh], false];
        yield 'lifetime, checked 8 days ago' => [['license_key' => 'k', 'expires_at' => '', 'last_success_at' => self::NOW - 8 * DAY_IN_SECONDS], true];
        yield 'no key stored' => [['expires_at' => '', 'last_success_at' => null], false];
    }

    /** @param array<string, mixed> $licence */
    #[DataProvider('licences')]
    public function testTheCadence(array $licence, bool $due): void
    {
        $this->assertSame($due, RefreshCron::isDue($licence, self::NOW));
    }

    public function testADueCheckAsksForTheStatusAndThenTheSites(): void
    {
        $this->nexusLicense = ['expires_at' => gmdate('Y-m-d H:i:s', time() + 5 * DAY_IN_SECONDS)];
        $this->activateLicenceHere();
        $this->nexusCalls = [];

        (new RefreshCron($this->freshSdk()->licenseManager()))->run();

        $validations = $this->nexusCallsTo('/api/v1/license/validate');
        $this->assertCount(2, $validations);
        $this->assertSame('', $validations[0]['domain'] ?? null, 'the status check went first, without a domain');
        $this->assertNotSame('', $validations[1]['domain'] ?? '', 'the sites were asked for without this site\'s domain');
    }

    public function testACheckThatIsNotDueCallsNothing(): void
    {
        $this->activateLicenceHere();
        $this->nexusCalls = [];

        (new RefreshCron($this->freshSdk()->licenseManager()))->run();

        $this->assertSame([], $this->nexusCalls);
    }

    public function testNoLicenceCallsNothing(): void
    {
        (new RefreshCron($this->freshSdk()->licenseManager()))->run();

        $this->assertSame([], $this->nexusCalls);
    }

    public function testItSchedulesItselfOnceAndUnschedules(): void
    {
        $cron = new RefreshCron($this->freshSdk()->licenseManager());
        $cron->hooks();
        $first = wp_next_scheduled(RefreshCron::HOOK);
        $cron->hooks();

        $this->assertNotFalse($first);
        $this->assertSame($first, wp_next_scheduled(RefreshCron::HOOK));

        RefreshCron::unschedule();
        $this->assertFalse(wp_next_scheduled(RefreshCron::HOOK));
    }

    /** @return array<string, mixed> */
    private static function licence(int $daysLeft, ?int $lastSuccess): array
    {
        return [
            'license_key' => 'k',
            'expires_at' => gmdate('Y-m-d H:i:s', self::NOW + $daysLeft * DAY_IN_SECONDS),
            'last_success_at' => $lastSuccess,
        ];
    }
}
