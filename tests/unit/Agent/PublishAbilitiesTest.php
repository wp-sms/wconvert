<?php

namespace WConvert\Tests\Unit\Agent;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Agent\AgentPublishing;
use WConvert\Agent\Publish;
use WConvert\Frontend\PageCache;
use WConvert\Rest\AgentController;
use WConvert\Rules\DisplayPlan;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WP_Error;
use WP_REST_Request;

require_once __DIR__ . '/../Support/installed-cache-plugins.php';

/**
 * #284: agents publish and pause only when "Let AI agents publish" is on
 * (ADR 0154 §7), and say what they cleared.
 */
#[CoversClass(AgentPublishing::class)]
#[CoversClass(AgentController::class)]
#[CoversClass(Publish\CampaignSwitch::class)]
#[CoversClass(Publish\Publish::class)]
#[CoversClass(Publish\Pause::class)]
final class PublishAbilitiesTest extends TestCase
{
    private AgentSite $site;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestAbilities'] = [];
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $this->site = new AgentSite();
        $this->site->occasions([['id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-20', 'end' => '2026-12-01']]);
        add_action('wconvert_published_set_changed', static function (): void { PageCache::purge(); });
    }

    protected function tearDown(): void
    {
        $this->site->close();
        $GLOBALS['wconvertTestCapabilities'] = [];
    }

    public function testTheSettingIsOffUntilSomeoneTurnsItOn(): void
    {
        $options = new FakeOptionStore();
        $publishing = new AgentPublishing($options);
        $controller = new AgentController($publishing);

        self::assertSame(['enabled' => false], $controller->show()->get_data());
        $request = new WP_REST_Request('POST');
        $request->set_param('enabled', true);
        self::assertSame(['enabled' => true], $controller->update($request)->get_data());
        self::assertSame(1, $options->get(AgentPublishing::OPTION));
    }

    public function testWhileItIsOffBothAreRefusedWithTheSentence(): void
    {
        $this->site->call('wconvert/find-campaigns', []);

        foreach (['wconvert/publish', 'wconvert/pause'] as $name) {
            $refused = ($GLOBALS['wconvertTestAbilities'][$name]['permission_callback'])(['campaign_id' => '01J00000000000000000000000']);
            self::assertInstanceOf(WP_Error::class, $refused);
            self::assertSame('Publishing by agents is off — a person can publish in WConvert → Campaigns', $refused->get_error_message());
            self::assertSame(403, $refused->get_error_data()['status']);
        }
    }

    public function testOnItPublishesAndNamesTheCachesItCleared(): void
    {
        $this->site->publishing->set(true);
        $id = $this->bar('Black Friday bar');

        $reply = $this->ask('wconvert/publish', ['campaign_id' => $id]);

        self::assertSame([['campaign_id' => $id, 'name' => 'Black Friday bar']], $reply['published']);
        self::assertSame([], $reply['failed']);
        self::assertSame(['WP Super Cache', 'Cache Enabler'], $reply['caches_cleared']);
        self::assertNotNull($this->site->optins->find($id)?->publishedAt);
        self::assertContains('POST /optins/' . $id . '/publish', $this->site->dispatched);

        $paused = $this->ask('wconvert/pause', ['campaign_id' => $id]);
        self::assertSame([['campaign_id' => $id, 'name' => 'Black Friday bar']], $paused['paused']);
        self::assertNull($this->site->optins->find($id)?->publishedAt);
    }

    /** An occasion run publishes what can go live and names the rest with the reason. */
    public function testAnOccasionRunNamesWhatWasSkippedAndWhatWasRefused(): void
    {
        $this->site->publishing->set(true);
        $ready = $this->bar('Black Friday bar');
        $empty = $this->site->draft('Teaser', 'grow_email_list', ['display_type' => 'popup', 'occasion' => 'black-friday-2026', 'display_rules' => DisplayPlan::immediate()]);
        $live = $this->bar('Already live');
        $this->site->optins->publish($live);

        $reply = $this->ask('wconvert/publish', ['occasion_id' => 'black-friday-2026']);

        self::assertSame([$ready], array_column($reply['published'], 'campaign_id'));
        self::assertSame([['campaign_id' => $empty, 'name' => 'Teaser', 'reason' => 'Choose a design before publishing. You can keep saving this campaign as a draft.']], $reply['failed']);
        self::assertSame([['campaign_id' => $live, 'name' => 'Already live', 'reason' => 'Already published, with no unpublished changes.']], $reply['skipped']);
        self::assertNull($this->site->optins->find($empty)?->publishedAt);
    }

    public function testNoDeleteIsEverOffered(): void
    {
        $this->site->call('wconvert/find-campaigns', []);

        foreach (array_keys($GLOBALS['wconvertTestAbilities']) as $name) {
            self::assertStringNotContainsString('delete', (string) $name);
        }
    }

    private function bar(string $name): string
    {
        $created = $this->site->call('wconvert/create-campaign', [
            'name' => $name, 'goal' => 'promote_offer', 'design_id' => 'bar-announcement',
            'copy' => ['headline' => '30% off everything', 'cta_label' => 'Shop the sale'],
            'link' => '/black-friday/', 'occasion_id' => 'black-friday-2026',
        ]);
        self::assertIsArray($created, $created instanceof WP_Error ? $created->get_error_message() : '');
        return (string) $created['campaign_id'];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function ask(string $name, array $input): array
    {
        $reply = $this->site->call($name, $input);
        self::assertIsArray($reply, $reply instanceof WP_Error ? $reply->get_error_message() : '');
        return $reply;
    }
}
