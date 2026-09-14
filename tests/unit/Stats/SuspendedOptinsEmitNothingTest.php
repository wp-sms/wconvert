<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\BeaconController;
use WConvert\Rest\RateLimit;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\OptinDesign;
use WConvert\Tests\Unit\Support\FakeTransientStore;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_REST_Request;

/**
 * =============================================================================
 * A SUSPENDED OPTIN EMITS NOTHING — *NO* ROWS, NOT ZERO-VALUED ONES.
 * =============================================================================
 * ADR 0027 calls a [[Suspended]] Optin *silent*, and the reason is arithmetic:
 * a suspended Optin contributing zeroes against a live denominator makes two
 * periods incomparable, and the counter shape means a wrong number **can never
 * be recomputed** (ADR 0019). The failure is invisible unless something
 * asserts it, which is what this file is.
 *
 * It asserts the negative at the only place it can be observed — the statement
 * the beacon would run — rather than at the payload, because the payload is
 * only half the story: **a page cached before the dependency went away still
 * carries the entry**, and its loader still beacons. That is exactly the
 * traffic this has to swallow.
 *
 * The route end to end stays `bin/verify-stats.php`'s, in a real WordPress
 * against a real table. What is proven here is which ids may be counted at
 * all.
 */
#[CoversClass(BeaconController::class)]
#[CoversClass(Degradation::class)]
final class SuspendedOptinsEmitNothingTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * A real browser's user agent. {@see \WConvert\Stats\BeaconTraffic} drops
     * bot traffic, and PHPUnit's empty one reads as exactly that — so a test
     * that sent none would assert "nothing was counted" for the wrong reason,
     * every time, including where the Optin was running perfectly.
     */
    private const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        . ' (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

    private FakeConnection $stats;

    private PublishedSet $publishedSet;

    private OptinRepository $optins;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $_SERVER['REMOTE_ADDR'] = '198.51.100.7';

        $this->stats = new FakeConnection();
        $this->publishedSet = new PublishedSet(new FakeOptionStore());
        $this->optins = new OptinRepository(
            new FakeConnection(),
            $this->publishedSet,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new MilestoneStore(new FakeOptionStore()
        ));
    }

    /**
     * @param list<array<string, mixed>> $rules
     */
    private function publish(array $rules): string
    {
        $optin = $this->optins->create('Spring sale', 'promote_offer', ['rules' => $rules, 'template' => OptinDesign::template()]);
        $this->optins->publish($optin->id);

        return $optin->id;
    }

    /**
     * Three events for one Optin, exactly as a page that was cached while Pro
     * was still installed would send them on `pagehide`.
     */
    private function beacon(string $optinId, Degradation $install): void
    {
        $controller = new BeaconController(
            $this->publishedSet,
            new StatsRepository($this->stats),
            new RateLimit(new FakeTransientStore()),
            $install
        );

        $request = new WP_REST_Request('POST', '/wconvert/v1/beacon');
        $request->set_header('user-agent', self::CHROME);
        $request->set_body((string) json_encode(['events' => [
            ['optin_id' => $optinId, 'kind' => 'impression'],
            ['optin_id' => $optinId, 'kind' => 'conversion'],
            ['optin_id' => $optinId, 'kind' => 'dismiss'],
        ]]));

        $response = $controller->record($request);

        // 204 either way. There is nobody on the page to read a response —
        // `sendBeacon` fires during `pagehide` and discards it — so a status
        // describing a condition the client cannot fix would be a status
        // nothing reads.
        $this->assertSame(204, $response->get_status());
    }

    public function testASuspendedOptinContributesNoRowsAtAll(): void
    {
        $id = $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $this->beacon($id, InstalledRules::free());

        $this->assertSame([], $this->stats->upserts, 'a suspended Optin reached the counters');
    }

    /**
     * The other half, and the one that makes the assertion above mean
     * something: the identical batch DOES count where the Optin is running. A
     * beacon that counted nothing for everybody would pass the test above and
     * lose every number on the site.
     */
    public function testTheSameBatchCountsWhereTheOptinIsRunning(): void
    {
        $id = $this->publish([['type' => 'click_element', 'selector' => '#buy']]);

        $this->beacon($id, InstalledRules::withPro());

        $this->assertCount(3, $this->stats->upserts);
        $this->assertSame([$id, $id, $id], array_column(array_column($this->stats->upserts, 'params'), 0));
    }

    /**
     * A DEGRADED Optin is not a suspended one. It is still shown — with a
     * substituted Trigger — so it still has [[Impression]]s and
     * [[Conversion]]s to report, and dropping those would punish the merchant
     * for the plugin they removed rather than the popup they built.
     */
    public function testADegradedOptinKeepsCounting(): void
    {
        $id = $this->publish([['type' => 'exit_intent']]);

        $this->beacon($id, InstalledRules::free());

        $this->assertCount(3, $this->stats->upserts);
    }
}
