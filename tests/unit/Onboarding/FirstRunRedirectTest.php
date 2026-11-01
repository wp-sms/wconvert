<?php

namespace WConvert\Tests\Unit\Onboarding;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Onboarding\FirstRunRedirect;

/**
 * One redirect to Campaigns after activation, and only when it helps (ADR 0176).
 */
#[CoversClass(FirstRunRedirect::class)]
final class FirstRunRedirectTest extends TestCase
{
    private const CLEAR = ['bulk' => false, 'ajax' => false, 'cli' => false, 'network' => false, 'capable' => true, 'has_campaigns' => false];

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestTransients'] = [];
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $GLOBALS['pagenow'] = 'plugins.php';
        unset($_GET['activate-multi']);
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['pagenow'], $_GET['activate-multi']);
    }

    public function testAFirstActivationByAnAdminRedirects(): void
    {
        $this->assertTrue(FirstRunRedirect::decide(self::CLEAR));
    }

    /** @return iterable<string, array{string, bool}> */
    public static function guards(): iterable
    {
        yield 'bulk activation' => ['bulk', true];
        yield 'an AJAX request' => ['ajax', true];
        yield 'WP-CLI' => ['cli', true];
        yield 'the network admin' => ['network', true];
        yield 'a user who cannot manage options' => ['capable', false];
        yield 'a site that already has a campaign' => ['has_campaigns', true];
    }

    #[DataProvider('guards')]
    public function testEachGuardStopsTheRedirect(string $fact, bool $value): void
    {
        $this->assertFalse(FirstRunRedirect::decide([$fact => $value] + self::CLEAR));
    }

    public function testActivationArmsItOnceAndBulkOrNetworkActivationDoesNot(): void
    {
        FirstRunRedirect::arm(false, ['action' => 'activate-selected', 'checked' => ['a/a.php', 'wconvert/wconvert.php']]);
        $this->assertFalse(get_transient(FirstRunRedirect::TRANSIENT), 'Bulk.');

        FirstRunRedirect::arm(true, []);
        $this->assertFalse(get_transient(FirstRunRedirect::TRANSIENT), 'Network.');

        FirstRunRedirect::arm(false, ['action' => 'activate', 'plugin' => 'wconvert/wconvert.php']);
        $this->assertSame(1, get_transient(FirstRunRedirect::TRANSIENT));
    }

    public function testTheNextPluginsPageGoesToCampaignsOnceAndSpendsTheOffer(): void
    {
        $went = [];
        $redirect = new FirstRunRedirect(static fn (): bool => false, static function (string $to) use (&$went): void { $went[] = $to; });
        FirstRunRedirect::arm(false, []);

        $redirect->maybeRedirect();
        $redirect->maybeRedirect();

        $this->assertCount(1, $went);
        $this->assertStringEndsWith('admin.php?page=wconvert', $went[0]);
        $this->assertFalse(get_transient(FirstRunRedirect::TRANSIENT));
    }

    public function testOtherAdminPagesNeitherRedirectNorSpendTheOffer(): void
    {
        $went = [];
        $redirect = new FirstRunRedirect(static fn (): bool => false, static function (string $to) use (&$went): void { $went[] = $to; });
        FirstRunRedirect::arm(false, []);
        $GLOBALS['pagenow'] = 'index.php';

        $redirect->maybeRedirect();

        $this->assertSame([], $went);
        $this->assertSame(1, get_transient(FirstRunRedirect::TRANSIENT));
    }

    public function testAReactivatedSiteWithCampaignsStaysOnPlugins(): void
    {
        $went = [];
        $redirect = new FirstRunRedirect(static fn (): bool => true, static function (string $to) use (&$went): void { $went[] = $to; });
        FirstRunRedirect::arm(false, []);

        $redirect->maybeRedirect();

        $this->assertSame([], $went);
        $this->assertFalse(get_transient(FirstRunRedirect::TRANSIENT), 'Spent anyway: the offer is one-time.');
    }
}
