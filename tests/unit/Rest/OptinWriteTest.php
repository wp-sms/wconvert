<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\SiteFrequency;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Targeting\RoleRegistry;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_Error;
use WP_REST_Request;

/**
 * =============================================================================
 * WHAT THE WRITE STILL REFUSES, NOW THAT THE ACT BELONGS TO THE DESIGN.
 * =============================================================================
 * **One Optin has exactly one converting act, and its DESIGN decides which**
 * (CONTEXT.md, Conversion; ADR 0059). {@see \WConvert\Template\TemplateLibrary}
 * refuses a design offering two acts or none when it is registered, so a
 * registered design offers exactly one — and the [[Goal]] declares no act at
 * all any more, so there is no pairing left to disagree about. The whole
 * *"this design does not produce the outcome your Goal counts"* family of
 * refusals is gone, and with it five of seven greyed-out cards.
 *
 * Three refusals survive, and none of them is about an act matching a Goal:
 *
 * 1. **A design that cannot convert at all**, which reports zero forever under
 *    every Goal (ADR 0020).
 * 2. **A design that captures nothing**, under a Goal that counts deliveries
 *    or on an Optin holding [[Destination]] ids (ADR 0025, re-keyed).
 * 3. **An arm whose design converts differently from its siblings'**, which
 *    would compare a submission rate against a click rate (ADR 0045).
 *
 * Each is enforced HERE and not only on the screen, because
 * `POST /wconvert/v1/optins` takes a whole design in `config` and is
 * scriptable by anyone holding `manage_options` — ADR 0026's *"a screen is not
 * an enforcement mechanism"*.
 */
#[CoversClass(OptinController::class)]
final class OptinWriteTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    public function testReopenSettingsAreNormalizedAndInvalidLabelsRefused(): void
    {
        $draft = $this->create(Goal::GrowEmailList, ['template_id' => 'centred-card', 'teaser' => ['label' => ' Save ', 'gap' => 16]]);
        self::assertIsArray($draft);
        self::assertSame(['label' => 'Save'], $draft['config']['teaser']);
        $invalid = $this->create(Goal::GrowEmailList, ['teaser' => ['label' => ' ']]);
        self::assertInstanceOf(WP_Error::class, $invalid);
        self::assertSame('wconvert_configuration', $invalid->get_error_code());
        $inline = $this->create(Goal::GrowEmailList, ['display_type' => 'inline', 'teaser' => ['label' => 'Save']]);
        self::assertIsArray($inline);
        self::assertArrayNotHasKey('teaser', $inline['config']);
    }

    public function testOptionalRoutesNeverBecomePrimaryRoutesWhenSaving(): void
    {
        $email = '01JQ0000000000000000000001'; $sms = '01JQ0000000000000000000002';
        $draft = $this->create(Goal::GrowEmailList, ['template_id' => 'journey-email-then-sms',
            'destinations' => [$email], 'submission_settings' => ['sms-signup' => ['destination_ids' => [$sms]]]]);
        self::assertIsArray($draft);
        self::assertSame([$email], $draft['config']['destinations']);
        $settings = \WConvert\Template\CaptureContract::settings($draft['config'], Goal::GrowEmailList->value);
        self::assertSame([$email], $settings['email-signup']['destination_ids']);
        self::assertSame([$sms], $settings['sms-signup']['destination_ids']);
    }

    /**
     * **An SMS signup subscribes the `phone` channel** — the word WP SMS
     * declares and `CaptureContract` checks. Publish spelled it `sms`, which
     * no Destination type declares, so every SMS signup bound to WP SMS was
     * refused as "does not support its channel".
     */
    public function testAnOptionalSmsSignupPublishesToARouteThatTakesPhoneNumbers(): void
    {
        $email = $this->destinations->save(null, 'mailpoet', 'Newsletter', null, ['lists' => ['3']]);
        $sms = $this->destinations->save(null, 'wsms', 'SMS subscribers', null, []);
        $draft = $this->create(Goal::GrowEmailList, $this->withPhoneCountry(['template_id' => 'journey-email-then-sms',
            'destinations' => [$email->id], 'submission_settings' => ['sms-signup' => ['destination_ids' => [$sms->id]]]]));
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $response = $this->controller->publish($request);
        self::assertNotInstanceOf(WP_Error::class, $response, $response instanceof WP_Error ? $response->get_error_message() : '');
        self::assertNotNull($this->optins->find($draft['id'])?->publishedAt);
    }

    /** The same spelling decides the main signup of an SMS list, which WP SMS must be able to receive. */
    public function testAnSmsListPublishesToWpSms(): void
    {
        $sms = $this->destinations->save(null, 'wsms', 'SMS subscribers', null, []);
        $draft = $this->create(Goal::GrowSmsList, $this->withPhoneCountry(['template_id' => 'stacked-signup', 'destinations' => [$sms->id]]));
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $response = $this->controller->publish($request);
        self::assertNotInstanceOf(WP_Error::class, $response, $response instanceof WP_Error ? $response->get_error_message() : '');
    }

    /** The channel rule still refuses a route that cannot take the signup's channel. */
    public function testAnOptionalSmsSignupRefusesAnEmailOnlyRoute(): void
    {
        $email = $this->destinations->save(null, 'mailpoet', 'Newsletter', null, ['lists' => ['3']]);
        $draft = $this->create(Goal::GrowEmailList, $this->withPhoneCountry(['template_id' => 'journey-email-then-sms',
            'destinations' => [$email->id], 'submission_settings' => ['sms-signup' => ['destination_ids' => [$email->id]]]]));
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $response = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertSame('wconvert_signup_destination', $response->get_error_code());
    }

    public function testAnEmailOnlySmsDraftSavesButCannotBePublished(): void
    {
        $draft = $this->create(Goal::GrowSmsList, ['template_id' => 'centred-card']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $response = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertContains($response->get_error_code(), ['wconvert_optin_goal_incomplete', 'wconvert_optin_form_incomplete']);
        self::assertNull($this->optins->find($draft['id'])?->publishedAt);
    }

    /**
     * Without the journeys module's registration a journey stays a draft, and
     * the refusal names neither a product nor a tier (ADR 0116).
     */
    public function testAJourneyIsNotPublishedWhereNoModuleRegisteredJourneys(): void
    {
        \WConvert\Tests\Unit\Support\Journeys::off();
        $fixture = json_decode((string) file_get_contents(self::PLUGIN_DIR . '/tests/fixtures/journey-graph-coffee.json'), true);
        $draft = $this->create(Goal::FindMatch, ['template' => $fixture['template'], 'capture_mode' => 'local']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request(); $request->set_param('id', $draft['id']);
        $response = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertSame('wconvert_journey_unsupported', $response->get_error_code());
        self::assertStringNotContainsString('Pro', $response->get_error_message());
        self::assertNull($this->optins->find($draft['id'])?->publishedAt);
    }

    public function testJourneyRefusalIncludesItsRepairCategoryWithoutPublishingTheDraft(): void
    {
        $fixture = json_decode((string) file_get_contents(self::PLUGIN_DIR . '/tests/fixtures/journey-graph-coffee.json'), true);
        $template = $fixture['template'];
        foreach ($template['tree']['steps'] as &$screen) {
            if ($screen['kind'] === 'result') $screen['results'][0]['heading'] = '';
        }
        unset($screen);
        $draft = $this->create(Goal::FindMatch, ['template' => $template, 'capture_mode' => 'local']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request(); $request->set_param('id', $draft['id']);
        $response = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertSame('wconvert_optin_form_incomplete', $response->get_error_code());
        self::assertSame('results', $response->get_error_data()['issue']);
        self::assertNull($this->optins->find($draft['id'])?->publishedAt);
    }

    public function testUnpublishingDoesNotAllowAHistoryChangingGoalEdit(): void
    {
        $draft = $this->create(Goal::GrowEmailList, ['template_id' => 'centred-card', 'capture_mode' => 'local']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        self::assertNotInstanceOf(WP_Error::class, $this->controller->publish($request));
        $this->controller->unpublish($request);
        $request->set_param('goal', Goal::GrowSmsList->value);
        $response = $this->controller->update($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertSame('wconvert_optin_goal_locked', $response->get_error_code());
        self::assertSame(Goal::GrowEmailList->value, $this->optins->find($draft['id'])?->goal);
    }

    /** Leads stay in WConvert until a service is connected (ADR 0133); choosing to connect one and not finishing blocks. */
    public function testListCollectionKeepsLeadsLocallyUntilAServiceIsChosen(): void
    {
        $draft = $this->create(Goal::GrowEmailList, ['template_id' => 'centred-card']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        self::assertInstanceOf(\WP_REST_Response::class, $this->controller->publish($request));
        $request->set_param('config', $draft['config'] + ['capture_mode' => 'connected']);
        $this->controller->update($request);
        self::assertInstanceOf(WP_Error::class, $this->controller->publish($request));
    }

    public function testAConfiguredAudienceServiceSatisfiesEmailButNotPhoneCollection(): void
    {
        $destination = $this->destinations->save(null, 'mailpoet', 'Newsletter', null, ['lists' => ['3']]);
        foreach ([Goal::GrowEmailList, Goal::GrowSmsList] as $goal) {
            $draft = $this->create($goal, ['template_id' => $goal === Goal::GrowEmailList ? 'centred-card' : 'stacked-signup', 'destinations' => [$destination->id]]);
            self::assertIsArray($draft);
            $request = new WP_REST_Request();
            $request->set_param('id', $draft['id']);
            $response = $this->controller->publish($request);
            if ($goal === Goal::GrowEmailList) {
                self::assertInstanceOf(\WP_REST_Response::class, $response);
            } else {
                self::assertInstanceOf(WP_Error::class, $response);
                self::assertSame('wconvert_optin_goal_incomplete', $response->get_error_code());
            }
        }
    }

    public function testPrimaryEmailSignupMayAlsoSendItsPromisedResource(): void
    {
        $audience = $this->destinations->save(null, 'mailpoet', 'Newsletter', null, ['lists' => ['3']]);
        $reward = $this->destinations->save(null, 'lead_magnet_email', 'Guide', null, ['file_url' => 'https://example.org/guide.pdf']);
        $draft = $this->create(Goal::GrowEmailList, ['template_id' => 'centred-card', 'destinations' => [$audience->id, $reward->id]]);
        self::assertIsArray($draft);
        $request = new WP_REST_Request(); $request->set_param('id', $draft['id']);
        self::assertInstanceOf(\WP_REST_Response::class, $this->controller->publish($request));
    }

    /**
     * Kept in WConvert only, a lead magnet publishes and the review warns that
     * no file goes out (ADR 0133). A delivery route that is chosen still has
     * to be complete.
     */
    public function testALeadMagnetPublishesLocallyButAChosenDeliveryRouteMustBeComplete(): void
    {
        $draft = $this->create(Goal::DeliverLeadMagnet, ['template_id' => 'centred-card']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        self::assertInstanceOf(\WP_REST_Response::class, $this->controller->publish($request));
        $destination = $this->destinations->save(null, 'lead_magnet_email', 'Guide', null, []);
        $config = $draft['config'] + ['destinations' => [$destination->id]];
        $request->set_param('config', $config);
        $this->controller->update($request);
        self::assertInstanceOf(WP_Error::class, $this->controller->publish($request));
        $this->destinations->save($destination->id, 'lead_magnet_email', 'Guide', null, ['file_url' => 'https://example.org/guide.pdf']);
        self::assertInstanceOf(\WP_REST_Response::class, $this->controller->publish($request));
    }

    private OptinRepository $optins;

    private FakeConnection $db;

    private OptinController $controller;

    private SiteFrequency $siteFrequency;

    /** Shared by the repository and the controller, so both milestones land in one place. */
    private FakeOptionStore $milestones;

    private \WConvert\Destination\DestinationStore $destinations;

    protected function tearDown(): void
    {
        \WConvert\Tests\Unit\Support\Journeys::off();
    }

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        \WConvert\Tests\Unit\Support\Journeys::on();

        $templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $published = new PublishedSet(new FakeOptionStore());

        // A Pro install with a store, so the cart [[Goal]] is settable and the
        // refusals below are about the DESIGN rather than about availability.
        $pro = new FakeProPresence(Tier::Elite);
        $site = new FakeSitePresence([SiteDependency::WooCommerce, SiteDependency::MailPoet, SiteDependency::Wsms]);

        $this->milestones = new FakeOptionStore();

        $this->optins = new OptinRepository(
            $this->db = new FakeConnection(),
            $published,
            $vocabulary,
            new MilestoneStore($this->milestones)
        );

        $this->controller = new OptinController(
            $this->optins,
            $vocabulary,
            $templates,
            TemplateLibrary::fromDirectory($templates, self::PLUGIN_DIR),
            new GoalRegistry($pro, $site),
            $published,
            InstalledRules::withPro($vocabulary),
            new RuleCatalogue($vocabulary, $pro, $site, new RoleRegistry()),
            $this->siteFrequency = new SiteFrequency(new FakeOptionStore()),
            new MilestoneStore($this->milestones),
            $this->destinations = new \WConvert\Destination\DestinationStore(new FakeOptionStore()),
            (new \WConvert\Destination\DestinationRegistry($pro, $site))->register(
                new \WConvert\Destination\LeadMagnet\LeadMagnetDestinationType(new \WConvert\Tests\Unit\Support\FakeMailer())
            )->register(new \WConvert\Destination\MailPoet\MailPoetDestinationType(new \WConvert\Tests\Unit\Support\FakeMailPoetSubscribers()))
                ->register(new \WConvert\Destination\Wsms\WsmsDestinationType(new \WConvert\Tests\Unit\Support\FakeWsmsContacts()))
        );
    }

    /**
     * The journey's design with its phone field set to one country, so the
     * site-wide default is not what decides whether it publishes.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function withPhoneCountry(array $config): array
    {
        $file = dirname(__DIR__, 3) . '/resources/templates/library/' . $config['template_id'] . '.json';
        $config['template'] = json_decode((string) file_get_contents($file), true);
        return \WConvert\Template\TemplateTree::rewrittenIn($config, static function (array $node): array {
            if (($node['type'] ?? '') === 'consent') { $node['hidden'] = false; }
            if (($node['type'] ?? '') === 'field' && ($node['name'] ?? '') === 'phone') { $node['phone_country'] = 'US'; }
            return $node;
        });
    }

    /**
     * @param array<string, mixed> $config
     * @return WP_Error|array<string, mixed>
     */
    private function create(Goal $goal, array $config)
    {
        $request = new WP_REST_Request();
        $request->set_param('name', 'Under test');
        $request->set_param('goal', $goal->value);
        if (!isset($config['template']) && isset($config['template_id'])) {
            $file = dirname(__DIR__, 3) . '/resources/templates/library/' . $config['template_id'] . '.json';
            if (is_file($file)) {
                $config['template'] = json_decode((string) file_get_contents($file), true);
                if ($goal->outcome()->audienceChannel !== null) {
                    $config = \WConvert\Template\TemplateTree::rewrittenIn($config, static function (array $node): array {
                        if (($node['type'] ?? '') === 'consent') { $node['hidden'] = false; }
                        return $node;
                    });
                }
            }
        }
        $request->set_param('config', $config + ['display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);

        $response = $this->controller->store($request);

        if ($response instanceof WP_Error) {
            return $response;
        }

        /** @var array<string, mixed> $data */
        $data = $response->get_data();

        return $data;
    }

    public function testPlacementIsNormalizedAgainstTheDisplayTypeOnWrite(): void
    {
        $topBar = $this->create(Goal::GrowEmailList, [
            'display_type' => 'floating_bar',
            'placement' => 'block_start',
        ]);
        $bottomBar = $this->create(Goal::GrowEmailList, [
            'display_type' => 'floating_bar',
            'placement' => 'block_end',
        ]);
        $wrongShape = $this->create(Goal::GrowEmailList, [
            'display_type' => 'slide_in',
            'placement' => 'block_start',
        ]);

        self::assertIsArray($topBar);
        self::assertSame('block_start', $topBar['config']['placement']);
        self::assertIsArray($bottomBar);
        self::assertArrayNotHasKey('placement', $bottomBar['config']);
        self::assertIsArray($wrongShape);
        self::assertArrayNotHasKey('placement', $wrongShape['config']);
    }

    public function testFullscreenSurvivesWriteWithoutAnOverlayPlacement(): void
    {
        $draft = $this->create(Goal::GrowEmailList, [
            'display_type' => 'fullscreen',
            'placement' => 'block_start',
        ]);

        self::assertIsArray($draft);
        self::assertSame('fullscreen', $draft['config']['display_type']);
        self::assertArrayNotHasKey('placement', $draft['config']);
    }

    public function testAutomaticInlineRejectsDelayedTriggersAndOtherFormatsDropTheSetting(): void
    {
        $draft = $this->create(Goal::GrowEmailList, ['display_type' => 'inline',
            'inline_placement' => ['position' => 'after_paragraph', 'paragraph' => 3]]);
        self::assertIsArray($draft);
        self::assertSame('after_content', $draft['config']['inline_placement']['fallback']);
        $delayed = $this->create(Goal::GrowEmailList, ['display_type' => 'inline',
            'inline_placement' => ['position' => 'after_content'], 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'time_on_page', 'seconds' => 10]])]);
        self::assertInstanceOf(WP_Error::class, $delayed);
        self::assertSame('wconvert_inline_trigger', $delayed->get_error_code());
        $popup = $this->create(Goal::GrowEmailList, ['display_type' => 'popup', 'inline_placement' => ['position' => 'after_content']]);
        self::assertIsArray($popup);
        self::assertArrayNotHasKey('inline_placement', $popup['config']);
    }

    public function testPublishRechecksAutomaticPlacementEvenForADraftWrittenOutsideRest(): void
    {
        $created = $this->create(Goal::GrowEmailList, ['template_id' => 'reading-slip', 'display_type' => 'inline',
            'capture_mode' => 'local', 'inline_placement' => ['position' => 'after_content']]);
        self::assertIsArray($created);
        $config = $created['config'];
        $config['display_rules'] = \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'time_on_page', 'seconds' => 10]]);
        $this->optins->saveDraft($created['id'], null, null, $config);
        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $response = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertSame('wconvert_inline_trigger', $response->get_error_code());
        self::assertNull($this->optins->find($created['id'])?->publishedAt);
    }

    public function testContentLockPublicationChecksFormAndAllVariantDrafts(): void
    {
        $parent = $this->create(Goal::GrowEmailList, array_merge(self::choiceDraft([['value' => 'guide', 'label' => 'Guide']]), ['display_type' => 'inline', 'capture_mode' => 'local', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]));
        self::assertIsArray($parent);
        $arm = $this->optins->createVariant($parent['id']);
        self::assertNotNull($arm);
        $config = $parent['config'];
        $config['content_lock'] = ['mode' => 'hide'];
        $this->optins->saveDraft($parent['id'], null, null, $config);
        $request = new WP_REST_Request(); $request->set_param('id', $parent['id']);
        $refused = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame('wconvert_content_lock_family', $refused->get_error_code());
        $this->optins->saveDraft($arm->id, null, null, $config);
        self::assertNotInstanceOf(WP_Error::class, $this->controller->publish($request));
        $config['display_rules'] = \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'time_on_page', 'seconds' => 10]]);
        $this->optins->saveDraft($parent['id'], null, null, $config);
        $refused = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame('wconvert_content_lock', $refused->get_error_code());
    }

    /** @param mixed $options
     * @return array<string, mixed>
     */
    private static function choiceDraft($options): array
    {
        return ['template' => ['tokens' => [], 'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
            ['type' => 'stack', 'children' => [
                ['type' => 'field', 'name' => 'email', 'required' => true],
                ['type' => 'field', 'name' => 'interest', 'options' => $options],
                ['type' => 'consent', 'text' => 'Send me email updates.', 'hidden' => false],
                ['type' => 'button', 'action' => 'submit', 'label' => 'Send'],
            ]],
            ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Thanks']]],
        ]])]];
    }

    public function testUnknownNavigationIsRefusedBeforeNormalizationCanChangeItsMeaning(): void
    {
        $config = self::choiceDraft([]);
        $config['template']['tree']['steps'][0]['content']['children'][3]['action'] = 'autosave';
        $refusal = $this->create(Goal::GrowEmailList, $config);
        self::assertInstanceOf(WP_Error::class, $refusal);
        self::assertSame('wconvert_template_action', $refusal->get_error_code());
    }

    /** @return array<string, array{mixed}> */
    public static function malformedChoices(): array
    {
        $valid = ['value' => 'repair', 'label' => 'Repair'];
        return [
            'not a list' => ['repair'],
            'null' => [null],
            'malformed row beside valid' => [[$valid, null]],
            'blank label' => [[['value' => 'repair', 'label' => ' ']]],
            'duplicate sent value' => [[$valid, ['value' => 'repair', 'label' => 'Installation']]],
            'newline sent value' => [[['value' => "repair\n", 'label' => 'Repair']]],
            'keyed map' => [['answer' => $valid]],
            'too many choices' => [array_map(static fn (int $at): array => ['value' => 'option-' . $at, 'label' => 'Answer ' . $at], range(1, 13))],
        ];
    }

    /** @param mixed $options */
    #[DataProvider('malformedChoices')]
    public function testCreateRefusesChoicesThatNormalizationWouldDiscard($options): void
    {
        $refusal = $this->create(Goal::GrowEmailList, self::choiceDraft($options));
        self::assertInstanceOf(WP_Error::class, $refusal);
        self::assertSame('wconvert_optin_choices_invalid', $refusal->get_error_code());
        self::assertSame([], $this->db->writes);
    }

    public function testRefusedChoiceEditPreservesTheSavedNameGoalAndAllAnswers(): void
    {
        $options = [['value' => 'repair', 'label' => 'Repair'], ['value' => 'installation', 'label' => 'Installation']];
        $created = $this->create(Goal::GrowEmailList, self::choiceDraft($options));
        self::assertIsArray($created);
        $this->db->writes = [];
        $options[1]['value'] = 'repair';
        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('name', 'A name that must not be saved');
        $request->set_param('goal', Goal::PromoteOffer->value);
        $request->set_param('config', self::choiceDraft($options) + ['display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);
        $refusal = $this->controller->update($request);
        self::assertInstanceOf(WP_Error::class, $refusal);
        self::assertSame('wconvert_optin_choices_invalid', $refusal->get_error_code());
        self::assertSame([], $this->db->writes);
        $saved = $this->optins->find($created['id']);
        self::assertNotNull($saved);
        self::assertSame($created['config'], $saved->config);
        self::assertSame('Under test', $saved->name);
        self::assertSame(Goal::GrowEmailList->value, $saved->goal);
    }

    public function testAnIntentionallyEmptyChoiceListCanBeCreatedAndSavedAsADraft(): void
    {
        $created = $this->create(Goal::GrowEmailList, self::choiceDraft([]));
        self::assertIsArray($created);
        self::assertSame([], $created['config']['template']['tree']['steps'][0]['content']['children'][1]['options']);
        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('name', 'Still unfinished');
        $request->set_param('config', $created['config']);
        $saved = $this->controller->update($request);
        self::assertNotInstanceOf(WP_Error::class, $saved);
        self::assertSame([], $this->optins->find($created['id'])?->config['template']['tree']['steps'][0]['content']['children'][1]['options']);
    }

    // ========================================================================
    // THE ACT IS THE DESIGN'S, SO NO PAIRING IS REFUSED (ADR 0059).
    // ========================================================================

    /**
     * **A cart Optin CAN be given a design with a form on it**, and this
     * asserted the opposite.
     *
     * `stacked-signup` captures a phone number and converts on its submit. Under
     * the cart [[Goal]] it used to be refused outright — a merchant who wanted
     * *"enter your email and we'll save your cart"* met a red bar telling them
     * to pick a design that matched the Goal, with no control anywhere that
     * changed one. ADR 0025 itself named that use case and routed it to a
     * different Goal; it now just works where the merchant asked for it.
     *
     * The Optin reports the submissions its design produces, under the card its
     * Goal groups it on, and `wconvert_stats` stores the same `conversion` kind
     * either way — so nothing about the number changes, only which act produced
     * it.
     */
    public function testACartOptinTakesADesignThatCapturesSomething(): void
    {
        $created = $this->create(Goal::RecoverCart, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($created);
        $this->assertSame('recover_cart', $created['goal'] ?? null);
        $this->assertSame('stacked-signup', $created['config']['template_id'] ?? null);
    }

    /** The mirror: a list-growing Goal takes the design that links away. */
    public function testAnEmailOptinTakesADesignThatOnlyLinksAway(): void
    {
        $created = $this->create(Goal::GrowEmailList, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);
        $this->assertSame('offer-panel', $created['config']['template_id'] ?? null);
    }

    /** And the pairing the cart Goal ships Playbooks for is still accepted. */
    public function testACartOptinTakesTheOneStepClickMeteredDesign(): void
    {
        $created = $this->create(Goal::RecoverCart, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);
        $this->assertSame('recover_cart', $created['goal'] ?? null);
    }

    // ========================================================================
    // SURVIVING REFUSAL: A GOAL COUNTING DELIVERIES NEEDS A CAPTURE.
    // ========================================================================

    /**
     * **The one Goal-shaped refusal left.** `lead_magnet_delivered` is written
     * when a push to the lead-magnet [[Destination]] succeeds, and there is
     * nothing to push unless the visitor gave an address — so under a design
     * with no field on it the headline reads zero forever, which is ADR 0020's
     * failure that looks broken while being right.
     */
    public function testADeliveryGoalCanSaveAnIncompleteDesignButCannotPublishIt(): void
    {
        $draft = $this->create(Goal::DeliverLeadMagnet, ['template_id' => 'offer-panel']);
        self::assertIsArray($draft);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $refusal = $this->controller->publish($request);
        self::assertInstanceOf(WP_Error::class, $refusal);
        self::assertSame('wconvert_optin_goal_incomplete', $refusal->get_error_code());
    }

    /** And it takes a design that captures, whatever that design captures. */
    public function testADeliveryGoalTakesAnyDesignWithAFieldOnIt(): void
    {
        $created = $this->create(Goal::DeliverLeadMagnet, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($created);
        $this->assertSame('deliver_lead_magnet', $created['goal'] ?? null);
    }

    /**
     * **A goal-only PATCH is checked against the design the Optin already
     * holds.**
     *
     * Both refusals used to be guarded on an incoming `config`, so
     * `PATCH {"goal": …}` carrying none wrote any settable Goal onto any design
     * and any binding with nothing asked at all. It was unreachable from the
     * admin — which is exactly ADR 0026's point about the goal screen, and this
     * route is scriptable by anyone holding `manage_options`. It matters more
     * now that there IS a control that changes a Goal (ADR 0059).
     */
    public function testAGoalOnlyDraftChangeCanBeSavedBeforeTheDesignIsAdjusted(): void
    {
        $created = $this->create(Goal::PromoteOffer, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('goal', Goal::DeliverLeadMagnet->value);

        $refusal = $this->controller->update($request);

        self::assertInstanceOf(\WP_REST_Response::class, $refusal);
        self::assertSame(Goal::DeliverLeadMagnet->value, $refusal->get_data()['goal']);
    }

    /**
     * **And a PATCH carrying only a name is not asked the question**, on an
     * Optin whose stored pairing is fine — the guard is about the pair being
     * WRITTEN, not about re-auditing a row on every rename.
     */
    public function testARenameIsNotAskedAboutTheDesign(): void
    {
        $created = $this->create(Goal::PromoteOffer, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('name', 'Renamed');

        $response = $this->controller->update($request);

        $this->assertNotInstanceOf(WP_Error::class, $response);
    }

    /**
     * **A design offering nothing is not refused.** A draft mid-creation has
     * no template yet, and refusing one would block the very save that is
     * about to add it — the same reasoning that makes the Trigger check ask
     * whether one could FIRE rather than counting them.
     */
    public function testADraftWithNoDesignYetIsStillSaved(): void
    {
        $this->assertIsArray($this->create(Goal::RecoverCart, []));
    }

    // ========================================================================
    // A SWAPPED FIELD SURVIVES THE ROUND TRIP, AND ITS ROLES FOLLOW THE KIND.
    // ========================================================================

    /**
     * **The editor's ⇄ changes what a field captures**, which is a param the
     * server rewrites the tree around: `normalize()` keeps only declared keys,
     * and a `field`'s [[Slot Role]]s are DERIVED from `name` rather than
     * declared on the node (CONTEXT.md, Slot Role).
     *
     * So this is the half the browser cannot answer: that a design arriving
     * with `name: "phone"` and the merchant's own wording comes back with all
     * three intact, and that what a [[Playbook]] would bind to it moved with
     * the kind.
     */
    public function testAFieldSwappedToAnotherKindKeepsItsWordingThroughTheSave(): void
    {
        $created = $this->create(Goal::GrowEmailList, [
            'template_id' => 'centred-card',
            'template' => [
                'tokens' => [],
                'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree([
                    'steps' => [
                        [
                            'type' => 'stack',
                            'children' => [
                                [
                                    'type' => 'field',
                                    'name' => 'phone',
                                    'label' => 'Where do we text it?',
                                    'placeholder' => '+44 7700 900000',
                                    'required' => true,
                                ],
                                ['type' => 'button', 'role' => 'cta_label', 'label' => 'Send it', 'action' => 'submit'],
                            ],
                        ],
                        ['type' => 'stack', 'children' => [['type' => 'heading', 'role' => 'success_headline', 'text' => 'Done']]],
                    ],
                ]),
            ],
        ]);

        $this->assertIsArray($created);

        /** @var array<string, mixed> $field */
        $field = $created['config']['template']['tree']['steps'][0]['content']['children'][0];

        $this->assertSame('phone', $field['name']);
        $this->assertSame('Where do we text it?', $field['label']);
        $this->assertSame('+44 7700 900000', $field['placeholder']);
    }

    /**
     * The other half: the Roles a Playbook binds to are the PHONE's, and the
     * email's are gone — a swap that left `email_label` behind would bind an
     * email Playbook's wording onto a phone field.
     */
    public function testASwappedFieldOffersTheRolesOfItsNewKind(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $tree = \WConvert\Tests\Unit\Support\JourneyFixture::tree([
            'steps' => [
                [
                    'type' => 'stack',
                    'children' => [
                        ['type' => 'field', 'name' => 'phone', 'label' => 'Where do we text it?'],
                    ],
                ],
            ],
        ]);

        $roles = \WConvert\Template\SlotRoles::declaredIn($tree, $vocabulary);

        $this->assertContains('phone_label', $roles);
        $this->assertNotContains('email_label', $roles);
    }

    // ========================================================================
    // A DESIGN THAT CAPTURES NOTHING HOLDS NO DESTINATION IDS.
    // ========================================================================

    /**
     * *"Its Optins carry no form node, write no [[Lead]], snapshot no
     * [[Consent Record]] and hold no [[Destination]] ids"* (#36). An Optin
     * whose design captures nothing has no Lead to push, so a bound
     * Destination is configuration that can never fire.
     *
     * **Keyed on the DESIGN's capture rather than on the Goal's act**
     * (ADR 0059), which is what ADR 0025 was always arguing: the reason there
     * is nothing to send is the absent form, and the act was only ever how
     * that absence was reached. So it holds on an Optin under any Goal —
     * including one this install can no longer resolve, which is the case a
     * Goal-keyed check would have let lapse (ADR 0026).
     *
     * **Refused rather than stripped**, because stripping writes a decision
     * the merchant did not make and leaves them hunting for a binding that is
     * silently gone.
     */
    public function testAnOptinWhoseDesignCapturesNothingIsRefusedADestination(): void
    {
        $refusal = $this->create(Goal::RecoverCart, [
            'template_id' => 'offer-panel',
            'destinations' => ['01JQ0000000000000000000001'],
        ]);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_captures_nothing', $refusal->get_error_code());
    }

    /** The same design under a list-growing Goal, refused for the same reason. */
    public function testTheDestinationRefusalDoesNotDependOnTheGoal(): void
    {
        $refusal = $this->create(Goal::GrowEmailList, [
            'template_id' => 'offer-panel',
            'destinations' => ['01JQ0000000000000000000001'],
        ]);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_captures_nothing', $refusal->get_error_code());
    }

    /** A capturing design keeps them, which is the whole point of having them. */
    public function testAnOptinThatCapturesKeepsItsDestinations(): void
    {
        $created = $this->create(Goal::GrowEmailList, [
            'template_id' => 'stacked-signup',
            'destinations' => ['01JQ0000000000000000000001'],
        ]);

        $this->assertIsArray($created);
        $this->assertSame(['01JQ0000000000000000000001'], $created['config']['destinations'] ?? null);
    }

    /** And a capture design under the CART Goal keeps them too (ADR 0059). */
    public function testACartOptinThatCapturesMayBindADestination(): void
    {
        $created = $this->create(Goal::RecoverCart, [
            'template_id' => 'stacked-signup',
            'destinations' => ['01JQ0000000000000000000001'],
        ]);

        $this->assertIsArray($created);
        $this->assertSame(['01JQ0000000000000000000001'], $created['config']['destinations'] ?? null);
    }

    // ========================================================================
    // AND THE SAME QUESTION ON AN EDIT.
    // ========================================================================

    /**
     * **Correcting a Goal is allowed, and under C it is purely editorial.**
     *
     * A Goal is persistent, not frozen (CONTEXT.md, Goal). This asserted that
     * re-goaling a capture Optin onto the cart Goal was REFUSED, because that
     * would have left a form under a click metric — and there is no click
     * metric on a Goal any more (ADR 0059). The correction restates the whole
     * history against the new Goal and touches the design not at all.
     */
    public function testRegoallingACaptureOptinOntoTheCartGoalIsAllowed(): void
    {
        $created = $this->create(Goal::GrowEmailList, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('goal', Goal::RecoverCart->value);
        $request->set_param('config', $created['config']);

        $response = $this->controller->update($request);

        $this->assertNotInstanceOf(WP_Error::class, $response);
        $this->assertSame('recover_cart', $this->optins->find((string) $created['id'])?->goal);
    }

    /**
     * **And swapping the design alone is allowed too**, which is the edit the
     * gallery used to refuse on five of seven cards.
     */
    public function testSwappingInACaptureDesignOnACartOptinIsAllowed(): void
    {
        $created = $this->create(Goal::RecoverCart, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('config', ['template_id' => 'stacked-signup', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);

        $response = $this->controller->update($request);

        $this->assertNotInstanceOf(WP_Error::class, $response);
    }

    // ========================================================================
    // SURVIVING REFUSAL: TWO ARMS OF ONE TEST CONVERT THE SAME WAY.
    // ========================================================================

    /**
     * **The guarantee the shared [[Goal]] used to smuggle in** (ADR 0059).
     *
     * {@see \WConvert\Optin\OptinRepository::createVariant()} copies its
     * parent's Goal and says why: two arms metered by different acts put a
     * ~3% submission rate beside a ~25% click rate, and the rate under one is
     * not the rate under the other. That held only because a Goal declared an
     * act. A [[Variant]] is a whole Optin with its own `config` (ADR 0045), so
     * without this an edit to one arm breaks the comparison silently.
     */
    public function testAnArmWhoseDesignConvertsDifferentlyFromItsSiblingIsRefused(): void
    {
        $parent = $this->create(Goal::PromoteOffer, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($parent);

        $arm = $this->optins->createVariant((string) $parent['id']);

        $this->assertNotNull($arm);

        $request = new WP_REST_Request();
        $request->set_param('id', $arm->id);
        $request->set_param('config', ['template_id' => 'offer-panel', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);

        $refusal = $this->controller->update($request);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_arms_are_not_comparable', $refusal->get_error_code());
    }

    /** And the parent is asked it too — the parent is arm A, not a container. */
    public function testTheParentOfATestIsAskedTheSameQuestion(): void
    {
        $parent = $this->create(Goal::PromoteOffer, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($parent);
        $this->assertNotNull($this->optins->createVariant((string) $parent['id']));

        $request = new WP_REST_Request();
        $request->set_param('id', $parent['id']);
        $request->set_param('config', ['template_id' => 'offer-panel', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);

        $refusal = $this->controller->update($request);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_arms_are_not_comparable', $refusal->get_error_code());
    }

    /**
     * **An arm may still be given a different design of the same act**, which
     * is what an A/B test IS — two designs, one campaign, one metric.
     */
    public function testAnArmMayTakeADifferentDesignThatConvertsTheSameWay(): void
    {
        $parent = $this->create(Goal::PromoteOffer, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($parent);

        $arm = $this->optins->createVariant((string) $parent['id']);

        $this->assertNotNull($arm);

        $request = new WP_REST_Request();
        $request->set_param('id', $arm->id);
        $request->set_param('config', ['template_id' => 'centred-card', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);

        $this->assertNotInstanceOf(WP_Error::class, $this->controller->update($request));
    }

    public function testSavingAPreparedTemplateKeepsTheEditsMadeAfterChoosingIt(): void
    {
        $created = $this->create(Goal::PromoteOffer, ['template_id' => 'stacked-signup']);
        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('template_source', 'centred-card');
        $request->set_param('config', [
            'template_id' => 'centred-card',
            'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']]),
            'template' => [
                'tokens' => ['bg' => '#abcdef'],
                'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'text' => 'Edited after choosing', 'tokens' => ['fg' => '#123456'], 'narrow' => ['heading-size' => '2rem']],
                    ['type' => 'button', 'label' => 'Visit', 'action' => 'link', 'href' => 'https://example.test/offer'],
                ]]]]),
            ],
        ]);

        $response = $this->controller->update($request);
        $this->assertInstanceOf(\WP_REST_Response::class, $response);
        $config = $response->get_data()['config'];
        $this->assertSame('#abcdef', $config['template']['tokens']['bg']);
        $this->assertSame('Edited after choosing', $config['template']['tree']['steps'][0]['content']['children'][0]['text']);
        $this->assertSame(['fg' => '#123456'], $config['template']['tree']['steps'][0]['content']['children'][0]['tokens']);
        $this->assertSame(['heading-size' => '2rem'], $config['template']['tree']['steps'][0]['content']['children'][0]['narrow']);
        $this->assertArrayNotHasKey('template_source', $config);
    }

    /** An Optin that is not part of a test is never asked the question. */
    public function testAnOptinWithNoArmsMayChangeItsActFreely(): void
    {
        $created = $this->create(Goal::PromoteOffer, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('config', ['template_id' => 'offer-panel', 'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']])]);

        $this->assertNotInstanceOf(WP_Error::class, $this->controller->update($request));
    }

    // ========================================================================
    // AND THE HOLE THE STRUCTURE EDITOR OPENS, CLOSED ON THE SAME DAY.
    // ========================================================================

    /**
     * **`TemplateLibrary::refuse()` does not cover this and never did.** It
     * refuses a Template offering no converting act at REGISTRATION, of a
     * library entry read off disk. An Optin's own `config` never passed
     * through it — and never needed to, because before the structure editor
     * there was no way for an Optin's tree to lose its button: the settings
     * panel could not remove a node (ADR 0010), and `hidden` is not a param
     * `button` declares, so hiding it was inexpressible rather than merely
     * disallowed.
     *
     * An editor that can delete closes neither door, and the resulting Optin
     * renders, publishes, shows and reports **zero forever** — ADR 0020's
     * failure that looks broken while being right.
     */
    public function testADesignWithNothingThatConvertsIsRefused(): void
    {
        $refusal = $this->create(Goal::GrowEmailList, [
            'template' => [
                'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree([
                    'steps' => [
                        [
                            'type' => 'stack',
                            'children' => [
                                ['type' => 'heading', 'role' => 'headline', 'text' => 'Join'],
                                ['type' => 'field', 'name' => 'email', 'label' => 'Email'],
                            ],
                        ],
                    ],
                ]),
                'tokens' => [],
            ],
        ]);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_cannot_convert', $refusal->get_error_code());
    }

    /**
     * **The client-side guard is not the enforcement.** `PUT
     * /wconvert/v1/optins/{id}` takes a whole `config` and is scriptable by
     * anyone holding `manage_options` — ADR 0026's *"a screen is not an
     * enforcement mechanism"*, applied to the act rather than to the Goal.
     */
    public function testAnEditThatDeletesTheOnlyConvertingActIsRefused(): void
    {
        $created = $this->create(Goal::GrowEmailList, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($created);

        $config = $created['config'];
        $config['template']['tree']['steps'] = [
            ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Join']]],
        ];

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('config', $config);

        $refusal = $this->controller->update($request);

        $this->assertInstanceOf(\WP_REST_Response::class, $refusal);
        $this->assertInstanceOf(WP_Error::class, $this->controller->publish($request));
    }

    /**
     * **A config with no design is still saved**, which is the distinction the
     * refusal turns on: a draft mid-creation has no template yet, and refusing
     * one would block the save that is about to add it. What is refused is a
     * design that EXISTS and offers nothing.
     */
    public function testADraftWithNoDesignIsNotCaughtByTheConvertingActCheck(): void
    {
        $this->assertIsArray($this->create(Goal::GrowEmailList, ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => []])]]));
    }

    public function testAnIncompleteDraftCanBeSavedButCannotBePublished(): void
    {
        foreach ([[], ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => []])]]] as $config) {
            $draft = $this->create(Goal::GrowEmailList, $config);
            $this->assertIsArray($draft);
            $request = new WP_REST_Request();
            $request->set_param('id', $draft['id']);
            $refused = $this->controller->publish($request);

            $this->assertInstanceOf(WP_Error::class, $refused);
            $this->assertSame('wconvert_optin_needs_a_design', $refused->get_error_code());
            $this->assertSame(400, $refused->get_error_data()['status']);
            $this->assertNull($this->optins->find($draft['id'])?->publishedAt);
        }
    }

    public function testSavingAndPublishingReturnTheConfirmedSnapshotState(): void
    {
        $draft = $this->create(Goal::PromoteOffer, ['template' => \WConvert\Tests\Unit\Support\OptinDesign::template()]);
        $this->assertIsArray($draft);
        $this->assertFalse($draft['has_unpublished_changes']);
        $request = new WP_REST_Request();
        $request->set_param('id', $draft['id']);
        $first = $this->controller->publish($request);
        $this->assertNotInstanceOf(WP_Error::class, $first);
        $live = $first->get_data();
        $this->assertFalse($live['has_unpublished_changes']);
        $this->assertNull($live['suspended']);

        $config = $draft['config'];
        $config['template']['tokens']['bg'] = '#111111';
        $request->set_param('config', $config);
        $saved = $this->controller->update($request);
        $this->assertNotInstanceOf(WP_Error::class, $saved);
        $this->assertTrue($saved->get_data()['has_unpublished_changes']);
        $this->assertSame($live['published_config'], $saved->get_data()['published_config']);
        $read = $this->controller->show($request);
        $this->assertNotInstanceOf(WP_Error::class, $read);
        $this->assertTrue($read->get_data()['has_unpublished_changes']);

        $updated = $this->controller->publish($request);
        $this->assertNotInstanceOf(WP_Error::class, $updated);
        $this->assertFalse($updated->get_data()['has_unpublished_changes']);
        $this->assertSame('#111111', $updated->get_data()['published_config']['template']['tokens']['bg']);
        $this->assertNotNull($updated->get_data()['published_at']);
    }

    public function testTheListReturnsBooleanChangeFlagsForParentsAndArmsWithoutConfigBlobs(): void
    {
        $row = [
            'id' => 'PARENT', 'name' => 'Offer', 'goal' => 'promote_offer', 'parent_id' => null,
            'published_at' => '2026-09-10 10:00:00', 'deleted_at' => null, 'has_unpublished_changes' => '0',
        ];
        // SQL projections are canned: this fake deliberately does not implement
        // SQL expressions or duplicate the database's snapshot comparison.
        $this->db->answers = [[$row], [array_replace($row, [
            'id' => 'ARM', 'parent_id' => 'PARENT', 'has_unpublished_changes' => '1',
        ])]];
        $listed = $this->controller->index(new WP_REST_Request())->get_data();

        $this->assertFalse($listed[0]['has_unpublished_changes']);
        $this->assertTrue($listed[0]['arms'][0]['has_unpublished_changes']);
        $this->assertArrayNotHasKey('config', $listed[0]);
        $this->assertArrayNotHasKey('published_config', $listed[0]);
        $this->assertArrayNotHasKey('config', $listed[0]['arms'][0]);
    }

    /**
     * **It asks no Goal, and that is deliberate.** "Reports nothing at all" is
     * wrong under every Goal, including one this install can no longer
     * resolve — so a check that depended on a Goal would lapse on precisely
     * the rows ADR 0026 keeps working.
     */
    public function testTheConvertingActCheckSurvivesAnEditThatNamesNoGoal(): void
    {
        $created = $this->create(Goal::PromoteOffer, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);

        $config = $created['config'];
        $config['template']['tree']['steps'] = [['type' => 'stack', 'children' => []]];

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('config', $config);

        $refusal = $this->controller->update($request);

        $this->assertInstanceOf(\WP_REST_Response::class, $refusal);
        $this->assertInstanceOf(WP_Error::class, $this->controller->publish($request));
    }

    /** An edit that changes neither is left alone. */
    public function testAnEditThatTouchesNeitherIsAccepted(): void
    {
        $created = $this->create(Goal::RecoverCart, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('name', 'Renamed');

        $this->assertNotInstanceOf(WP_Error::class, $this->controller->update($request));
    }

    // ========================================================================
    // THE ALLOWANCE AND THE PRIORITY, WHICH TRAVELLED UNVALIDATED UNTIL THEY
    // GAINED AN AUTHOR (ADR 0047's amendment).
    // ========================================================================

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function savedConfig(array $config): array
    {
        $created = $this->create(Goal::PromoteOffer, $config);

        $this->assertIsArray($created, 'the fixture must save, or nothing below is about normalisation');

        /** @var array<string, mixed> $saved */
        $saved = $created['config'];

        return $saved;
    }

    /**
     * **The four fields the loader has always read, now validated on the way
     * in.** Until this, `frequency` was whatever the client posted: a config
     * blob key with no branch anywhere in PHP, reaching
     * `resources/loader/src/frequency.ts` as passthrough.
     */
    public function testTheAllowanceIsNormalisedOnTheWayIn(): void
    {
        $saved = $this->savedConfig(['frequency' => [
            'maxImpressions' => '3',
            'cooldownDays' => 0,
            'stopAfterDismiss' => true,
            'stopAfterConversion' => false,
            'once_per' => 'session',
        ]]);

        $this->assertSame(
            ['maxImpressions' => 3, 'stopAfterConversion' => false],
            $saved['frequency'] ?? null
        );
    }

    /**
     * **An allowance that says nothing loses its key entirely**, rather than
     * being stored as `[]`. The payload is inlined into every matching page
     * against a 2KB budget, and an empty object is bytes with no reader.
     */
    public function testAnAllowanceWithNothingInItIsDroppedRatherThanStoredEmpty(): void
    {
        $saved = $this->savedConfig(['frequency' => ['stopAfterDismiss' => true, 'maxImpressions' => 0]]);

        $this->assertArrayNotHasKey('frequency', $saved);
    }

    /**
     * **Absent and zero are the same rule**, because `arbitrate()` reads
     * `priority ?? 0` — so the spelling that costs nothing is the one to
     * store.
     */
    public function testAZeroPriorityIsDroppedAndANegativeOneIsKept(): void
    {
        $this->assertArrayNotHasKey('priority', $this->savedConfig(['priority' => 0]));
        $this->assertSame(-5, $this->savedConfig(['priority' => -5])['priority'] ?? null);
        $this->assertSame(10, $this->savedConfig(['priority' => '10'])['priority'] ?? null);
    }

    /** A priority that is not a number is not a priority. */
    public function testANonNumericPriorityIsDropped(): void
    {
        $this->assertArrayNotHasKey('priority', $this->savedConfig(['priority' => 'urgent']));
    }

    // ========================================================================
    // THE SCHEDULE, NORMALISED BESIDE THE ALLOWANCE AND REFUSED BY THE SAME
    // VALUE OBJECT.
    // ========================================================================

    /**
     * **The control's own value is canonicalised on the way in.** An
     * `<input type="datetime-local">` posts `2026-11-27T09:00`; what is stored
     * is the wall time, in one spelling, because
     * {@see \WConvert\Optin\PublishedProjection} resolves it against the
     * site's zone on every rebuild and a second spelling is a second parse.
     */
    public function testTheScheduleIsCanonicalisedOnTheWayIn(): void
    {
        $saved = $this->savedConfig([
            'starts_at' => '2026-11-27T09:00',
            'ends_at' => '2026-11-30T23:59:59',
        ]);

        $this->assertSame('2026-11-27 09:00', $saved['starts_at'] ?? null);
        $this->assertSame('2026-11-30 23:59', $saved['ends_at'] ?? null);
    }

    /** One boundary on its own is a schedule merchants mean, and it is kept. */
    public function testOneBoundaryOnItsOwnIsSaved(): void
    {
        $this->assertSame('2026-11-27 09:00', $this->savedConfig(['starts_at' => '2026-11-27 09:00'])['starts_at'] ?? null);
        $this->assertSame('2026-11-30 23:59', $this->savedConfig(['ends_at' => '2026-11-30 23:59'])['ends_at'] ?? null);
    }

    /**
     * **A value that was supplied and is not a moment is REFUSED**, not
     * dropped — and an emptied box is not the same thing.
     *
     * Dropping a supplied `ends_at` publishes a sale that never finishes,
     * which is the complaint this feature exists to answer;
     * {@see \WConvert\Optin\Frequency}'s "drop the nonsense to null" does not
     * transfer, because there a dropped value and the stored one mean the same
     * thing to the engine and here they do not.
     */
    public function testAScheduleThatIsNotAMomentIsRefused(): void
    {
        $refused = $this->create(Goal::PromoteOffer, ['starts_at' => 'next Friday']);

        $this->assertInstanceOf(WP_Error::class, $refused);
        $this->assertSame(400, $refused->get_error_data()['status'] ?? null);
    }

    /** An emptied box is the merchant saying "no boundary", and is saved as one. */
    public function testAnEmptiedBoxIsNoBoundaryRatherThanARefusal(): void
    {
        $saved = $this->savedConfig(['starts_at' => '', 'ends_at' => '']);

        $this->assertArrayNotHasKey('starts_at', $saved);
        $this->assertArrayNotHasKey('ends_at', $saved);
    }

    /**
     * ========================================================================
     * AN END BEFORE ITS START IS REFUSED, AND THE NORMALISER IS WHAT REFUSES.
     * ========================================================================
     * {@see \WConvert\Optin\Schedule::fromArray()} throws; this route turns
     * that into a 400. The rule is not spelled here, deliberately: ADR 0047
     * records what putting it here cost last time, and a schedule has a
     * second, non-REST author coming.
     *
     * Refused rather than repaired, for {@see \WConvert\Optin\Frequency}'s
     * stated reason applied one step further. Dropping the end would publish a
     * sale that never finishes — the *"it keeps popping up"* complaint this
     * whole feature exists to answer — and dropping the start would publish
     * one that can never show. Neither is a decision the merchant made.
     */
    public function testAnEndBeforeItsStartIsRefusedWithA400(): void
    {
        $refused = $this->create(Goal::PromoteOffer, [
            'starts_at' => '2026-11-30 09:00',
            'ends_at' => '2026-11-27 09:00',
        ]);

        $this->assertInstanceOf(WP_Error::class, $refused);
        $this->assertSame(400, $refused->get_error_data()['status'] ?? null);
    }

    /** A window with no width is refused for the same reason: nothing is inside it. */
    public function testAWindowThatEndsWhereItStartsIsRefused(): void
    {
        $this->assertInstanceOf(WP_Error::class, $this->create(Goal::PromoteOffer, [
            'starts_at' => '2026-11-27 09:00',
            'ends_at' => '2026-11-27 09:00',
        ]));
    }

    /** And an edit is refused the same way a create is. */
    public function testAnUpdateCarryingABackwardsScheduleIsRefused(): void
    {
        $created = $this->create(Goal::PromoteOffer, []);
        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('config', [
            'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']]),
            'starts_at' => '2026-11-30 09:00',
            'ends_at' => '2026-11-27 09:00',
        ]);

        $this->assertInstanceOf(WP_Error::class, $this->controller->update($request));
    }

    // ========================================================================
    // THE ALLOWANCE THE WHOLE SITE SHARES.
    // ========================================================================

    /**
     * The route answers with **all four fields**, off, on an install that has
     * asked for nothing — which is every install (ADR 0047).
     */
    public function testTheSiteAllowanceStartsOffAndSaysSoInFull(): void
    {
        $this->assertSame(
            [
                'maxImpressions' => null,
                'cooldownDays' => null,
                'stopAfterDismiss' => false,
                'stopAfterConversion' => false,
            ],
            $this->controller->showSiteFrequency()->get_data()
        );
    }

    /**
     * **A body that is not JSON is still a body.**
     *
     * `get_json_params()` is null for a form-encoded POST, and a null read as
     * "an empty allowance" would answer 200 while quietly turning the
     * merchant's site-wide cap off — the one way this route could destroy a
     * setting without saying anything.
     */
    public function testTheSiteAllowanceIsReadFromABodyThatIsNotJson(): void
    {
        $request = new WP_REST_Request();
        $request->set_param('stopAfterDismiss', true);
        $request->set_param('cooldownDays', 7);

        $saved = $this->controller->updateSiteFrequency($request)->get_data();

        $this->assertSame(true, $saved['stopAfterDismiss']);
        $this->assertSame(7, $saved['cooldownDays']);
        $this->assertTrue($this->siteFrequency->allowance()->stopAfterDismiss);
    }

    /**
     * A switch that is PRESENT but is not a yes is off. The engine's own read
     * is `!== false`, which would say on to a `null`, a `0` or a `"no"` — and
     * this route takes whatever a client sends.
     */
    public function testASwitchThatIsNotAYesDoesNotTurnTheSiteWideCapOn(): void
    {
        $request = new WP_REST_Request();
        $request->set_param('stopAfterDismiss', null);

        $saved = $this->controller->updateSiteFrequency($request)->get_data();

        $this->assertFalse($saved['stopAfterDismiss']);
    }
}
