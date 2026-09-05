<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\GoalRegistry;
use WConvert\Milestone\EditedPart;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\SiteFrequency;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
use WConvert\Targeting\RoleRegistry;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_REST_Request;

/**
 * ============================================================================
 * THE TWO RECORDERS, DRIVEN THROUGH THE PATHS A MERCHANT ACTUALLY TAKES.
 * ============================================================================
 * `RecordedOnceTest` proves the store's rule and `WhichSuggestionWentFirstTest`
 * proves the diff. Neither would notice if nothing ever called them — and a
 * milestone is exactly the kind of thing that passes a unit test and never
 * fires on a real install, because the only symptom is a screen that stays
 * empty forever.
 *
 * So this publishes and edits through {@see \WConvert\Rest\OptinController}
 * and {@see \WConvert\Optin\OptinRepository}, and reads the option back.
 */
#[CoversNothing]
final class RecordedOnTheRealPathTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** One option table behind both recorders, exactly as a real install has one. */
    private FakeOptionStore $options;

    private OptinRepository $optins;

    private OptinController $controller;

    private Prefill $prefill;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $this->options = new FakeOptionStore();

        $templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $rules = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $designs = TemplateLibrary::fromDirectory($templates, self::PLUGIN_DIR);
        $published = new PublishedSet(new FakeOptionStore());

        $pro = new FakeProPresence(Tier::Elite);
        $site = new FakeSitePresence([SiteDependency::WooCommerce]);

        $this->prefill = new Prefill(
            PlaybookLibrary::fromDirectory($designs, $templates, $rules, self::PLUGIN_DIR),
            $designs,
            $templates,
            InstalledRules::withPro($rules)
        );

        $this->optins = new OptinRepository(
            new FakeConnection(),
            $published,
            $rules,
            new MilestoneStore($this->options)
        );

        $this->controller = new OptinController(
            $this->optins,
            $rules,
            $templates,
            $designs,
            new GoalRegistry($pro, $site),
            $published,
            InstalledRules::withPro($rules),
            new RuleCatalogue($rules, $pro, $site, new RoleRegistry()),
            new SiteFrequency(new FakeOptionStore()),
            new MilestoneStore($this->options)
        );
    }

    private function milestones(): MilestoneStore
    {
        return new MilestoneStore($this->options);
    }

    private function controller(): OptinController
    {
        return $this->controller;
    }

    private function repository(): OptinRepository
    {
        return $this->optins;
    }

    /**
     * A new Optin from a real [[Playbook]], through the route the creation
     * flow takes: prefill hands back a draft, the draft is POSTed.
     *
     * @return array<string, mixed>
     */
    private function startFromAPlaybook(): array
    {
        $draft = $this->prefill->fromPlaybook('welcome-discount');

        $this->assertNotNull($draft);

        return $this->create($draft['name'], $draft['goal'], $draft['config']);
    }

    /**
     * And one with no Playbook behind it — *"start from scratch skips the
     * Playbook, never the Goal"*.
     *
     * @return array<string, mixed>
     */
    private function startFromScratch(): array
    {
        $draft = $this->prefill->fromScratch(\WConvert\Goal\Goal::GrowEmailList);

        return $this->create($draft['name'], $draft['goal'], $draft['config']);
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function create(string $name, string $goal, array $config): array
    {
        $request = new WP_REST_Request();
        $request->set_param('name', $name);
        $request->set_param('goal', $goal);
        $request->set_param('config', $config);

        $response = $this->controller->store($request);

        $this->assertNotInstanceOf(\WP_Error::class, $response);

        /** @var array<string, mixed> $data */
        $data = $response->get_data();

        return $data;
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function edit(string $id, array $config, ?string $goal = null): array
    {
        $request = new WP_REST_Request();
        $request->set_param('id', $id);
        $request->set_param('config', $config);

        if ($goal !== null) {
            $request->set_param('goal', $goal);
        }

        $response = $this->controller()->update($request);

        $this->assertNotInstanceOf(\WP_Error::class, $response);

        /** @var array<string, mixed> $data */
        $data = $response->get_data();

        return $data;
    }

    public function testPublishingStampsTheActivationMilestone(): void
    {
        $this->assertNull($this->milestones()->firstPublish());

        $optin = $this->startFromAPlaybook();
        $this->repository()->publish((string) $optin['id']);

        $this->assertNotNull($this->milestones()->firstPublish());
    }

    /**
     * **The seam, on the real path.** Publishing a second Optin months later
     * leaves the first date standing.
     */
    public function testASecondPublishOnTheRealPathMovesNothing(): void
    {
        $first = $this->startFromAPlaybook();
        $this->repository()->publish((string) $first['id']);

        $stamped = $this->milestones()->firstPublish();

        $second = $this->startFromAPlaybook();
        $this->repository()->publish((string) $second['id']);

        $this->assertSame($stamped, $this->milestones()->firstPublish());
    }

    /**
     * **An unpublish does not take the milestone with it**, which is the
     * failure `MIN(published_at)` would have had: that column is set back to
     * `NULL` here, so a derived date would move forwards the day a merchant
     * took their oldest Optin down.
     */
    public function testUnpublishingEverythingLeavesTheMilestoneStanding(): void
    {
        $optin = $this->startFromAPlaybook();

        $this->repository()->publish((string) $optin['id']);
        $stamped = $this->milestones()->firstPublish();
        $this->repository()->unpublish((string) $optin['id']);

        $this->assertNotNull($stamped);
        $this->assertSame($stamped, $this->milestones()->firstPublish());
        $this->assertNull($this->repository()->find((string) $optin['id'])?->publishedAt);
    }

    public function testEditingAPlaybookStartedOptinRecordsWhichPartWentFirst(): void
    {
        $optin = $this->startFromAPlaybook();

        $config = $optin['config'];
        $config['rules'] = [['type' => 'exit_intent']];

        $this->edit((string) $optin['id'], $config);

        $edit = $this->milestones()->firstEdit();

        $this->assertNotNull($edit);
        $this->assertSame('welcome-discount', $edit->playbook);
        $this->assertSame(EditedPart::Rules, $edit->part);
    }

    /** **The seam.** The second edit is the merchant working; the first is the signal. */
    public function testASecondEditOnTheRealPathMovesNeitherTheDateNorThePart(): void
    {
        $optin = $this->startFromAPlaybook();

        $config = $optin['config'];
        $config['rules'] = [['type' => 'exit_intent']];
        $saved = $this->edit((string) $optin['id'], $config);

        $again = $saved['config'];
        $again['template']['tokens']['color.accent'] = '#ff0055';
        $this->edit((string) $optin['id'], $again);

        $this->assertSame(EditedPart::Rules, $this->milestones()->firstEdit()?->part);
    }

    /**
     * A save that changed nothing is not an edit — and the builder sends the
     * whole draft on every save, so this is the common case rather than an
     * edge one.
     */
    public function testSavingWithoutChangingAnythingRecordsNothing(): void
    {
        $optin = $this->startFromAPlaybook();

        $this->edit((string) $optin['id'], $optin['config']);

        $this->assertNull($this->milestones()->firstEdit());
    }

    /**
     * **An Optin started from scratch has no suggestion to override.** There
     * is no `playbook_id`, so a first edit recorded against it could not say
     * which [[Goal]]'s defaults it was evidence about — which is the whole
     * point of the milestone.
     */
    public function testEditingAScratchBuiltOptinRecordsNothing(): void
    {
        $optin = $this->startFromScratch();

        $config = $optin['config'];
        $config['rules'] = [['type' => 'exit_intent']];

        $this->edit((string) $optin['id'], $config);

        $this->assertNull($this->milestones()->firstEdit());
    }

    /**
     * **A refused edit is not an edit.** The record can only be written once,
     * so an act the server rejected must not be the thing it holds forever.
     */
    public function testAnEditRefusedForItsScheduleRecordsNothing(): void
    {
        $optin = $this->startFromAPlaybook();

        $config = $optin['config'];
        $config['rules'] = [['type' => 'exit_intent']];
        $config['starts_at'] = '2026-06-11T10:00';
        $config['ends_at'] = '2026-06-11T09:00';

        $request = new WP_REST_Request();
        $request->set_param('id', (string) $optin['id']);
        $request->set_param('config', $config);

        $this->assertInstanceOf(\WP_Error::class, $this->controller()->update($request));
        $this->assertNull($this->milestones()->firstEdit());
    }

    /**
     * Correcting the [[Goal]] is the sharpest of the five, and it is a column
     * rather than a key of `config`.
     *
     * **Any settable Goal will do now** (ADR 0059). The correction used to
     * have to be one the design could still report — `welcome-discount` is a
     * capture design, so the SMS Goal was settable on it and a click-metered
     * one was not — and the act is the design's now, so the only Goal a
     * capture design cannot take is none of them.
     */
    public function testCorrectingTheGoalIsRecordedAsTheGoal(): void
    {
        $optin = $this->startFromAPlaybook();

        $this->edit((string) $optin['id'], $optin['config'], 'grow_sms_list');

        $this->assertSame(EditedPart::Goal, $this->milestones()->firstEdit()?->part);
    }

    /**
     * **And a Goal correction the design cannot report records nothing**, for
     * the same reason a refused schedule does: the route rejects it, so the
     * merchant did not make that change. This is the one that would have been
     * easy to get wrong by recording before the save.
     *
     * **The refusal it rides is the last Goal-shaped one** (ADR 0059): a Goal
     * counting deliveries over a design with no field on it. The Optin starts
     * from a cart [[Playbook]], whose design captures nothing.
     *
     * **And the PATCH carries NO `config`**, deliberately. Both refusals used
     * to be guarded on an incoming config, so a goal-only PATCH wrote any
     * settable Goal onto any design with nothing asked — unreachable from the
     * admin, and this route is scriptable by anyone holding `manage_options`
     * (ADR 0026). The Goal is checked against the design the Optin already
     * holds, so this is red without that fix.
     */
    public function testAGoalCorrectionTheDesignCannotReportRecordsNothing(): void
    {
        $draft = $this->prefill->fromPlaybook('cart-straight-away');

        $this->assertNotNull($draft);

        $optin = $this->create($draft['name'], $draft['goal'], $draft['config']);

        $request = new WP_REST_Request();
        $request->set_param('id', (string) $optin['id']);
        $request->set_param('goal', 'deliver_lead_magnet');

        $this->assertInstanceOf(\WP_Error::class, $this->controller()->update($request));
        $this->assertNull($this->milestones()->firstEdit());
    }
}
