<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\SiteHealthInfo;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Tier;
use WConvert\Support\TierManifest;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;

/**
 * Tools → Site Health → Info → WConvert: what support asks for first.
 */
#[CoversClass(SiteHealthInfo::class)]
final class SiteHealthInfoTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** @var list<string> */
    private array $capabilities;

    protected function setUp(): void
    {
        $this->capabilities = $GLOBALS['wconvertTestCapabilities'];
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = $this->capabilities;
    }

    public function testItNamesTheVersionThePlanAndHowManyCampaignsAreLive(): void
    {
        $connection = new FakeConnection();
        $connection->rows = [
            'a' => ['id' => 'a', 'parent_id' => null, 'published_at' => '2026-10-01 00:00:00', 'deleted_at' => null],
            'b' => ['id' => 'b', 'parent_id' => null, 'published_at' => null, 'deleted_at' => null],
            'c' => ['id' => 'c', 'parent_id' => null, 'published_at' => null, 'deleted_at' => null],
            'd' => ['id' => 'd', 'parent_id' => null, 'published_at' => '2026-10-01 00:00:00', 'deleted_at' => '2026-10-02 00:00:00'],
        ];

        $section = $this->info($connection, Tier::Elite)->addSection(['wp-core' => []]);

        $this->assertArrayHasKey('wp-core', $section, 'WordPress\'s own sections are kept');
        $fields = $section[SiteHealthInfo::SECTION]['fields'];
        $this->assertSame(WCONVERT_VERSION, $fields['version']['value']);
        $this->assertSame('elite', $fields['plan']['debug']);
        $this->assertNotSame('elite', $fields['plan']['value'], 'the plan is named, not slugged');
        $this->assertSame('1 published, 2 drafts', $fields['campaigns']['value'], 'a deleted campaign is not counted');
    }

    public function testSomebodyWhoCannotManageOptionsGetsNoSection(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [];

        $this->assertSame(['wp-core' => []], $this->info(new FakeConnection(), Tier::Free)->addSection(['wp-core' => []]));
    }

    public function testAFreeInstallReadsAsFree(): void
    {
        $this->assertSame('Free', $this->info(new FakeConnection(), Tier::Free)->fields()['plan']['value']);
    }

    private function info(FakeConnection $connection, Tier $tier): SiteHealthInfo
    {
        $optins = new OptinRepository(
            $connection,
            new PublishedSet(new FakeOptionStore()),
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new MilestoneStore(new FakeOptionStore())
        );

        return new SiteHealthInfo($optins, new FakeProPresence($tier), TierManifest::load(self::PLUGIN_DIR));
    }
}
