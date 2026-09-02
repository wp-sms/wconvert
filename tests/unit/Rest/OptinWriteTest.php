<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\OptinController;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_Error;
use WP_REST_Request;

/**
 * =============================================================================
 * THE PAIRING IS ENFORCED AT THE WRITE, NOT ONLY ON THE SCREEN.
 * =============================================================================
 * **One Optin has exactly one converting act, and its [[Goal]] decides which**
 * (CONTEXT.md, Conversion). A [[Playbook]] is checked against that at
 * registration and a [[Template]] is checked when it is registered, but
 * neither is an enforcement mechanism for an OPTIN: `POST /wconvert/v1/optins`
 * takes a whole design in `config` and is scriptable by anyone holding
 * `manage_options`.
 *
 * That is ADR 0026's own argument about the goal screen — *"a screen is not an
 * enforcement mechanism"* — applied to the other half of the pairing, and it
 * is what makes ADR 0025's *"the form is not merely unnecessary, it is
 * forbidden"* true of an Optin rather than only of the library.
 */
#[CoversClass(OptinController::class)]
final class OptinWriteTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private OptinRepository $optins;

    private OptinController $controller;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $published = new PublishedSet(new FakeOptionStore());

        // A Pro install with a store, so the cart [[Goal]] is settable and the
        // refusals below are about the DESIGN rather than about availability.
        $pro = new FakeProPresence(true);
        $site = new FakeSitePresence([SiteDependency::WooCommerce]);

        $this->optins = new OptinRepository(new FakeConnection(), $published, $vocabulary);

        $this->controller = new OptinController(
            $this->optins,
            $vocabulary,
            $templates,
            TemplateLibrary::fromDirectory($templates, self::PLUGIN_DIR),
            new GoalRegistry($pro, $site),
            $published,
            InstalledRules::withPro($vocabulary),
            new RuleCatalogue($vocabulary, $pro, $site)
        );
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
        $request->set_param('config', $config + ['rules' => [['type' => 'page_load']]]);

        $response = $this->controller->store($request);

        if ($response instanceof WP_Error) {
            return $response;
        }

        /** @var array<string, mixed> $data */
        $data = $response->get_data();

        return $data;
    }

    // ========================================================================
    // TDD SEAM: THE ONE-STEP, CLICK-METERED SHAPE.
    // ========================================================================

    /**
     * **A cart Optin cannot be given a design with a form on it.**
     *
     * `stacked-signup` is a two-step, submit-metered design — a form and the
     * success state after it. Filed under a click-metered Goal it reports
     * nothing at all, and worse than nothing: a click-metered Optin carrying a
     * form emits [[Lead]]s that are not [[Conversion]]s, which inverts
     * CONTEXT.md's rule rather than bending it (ADR 0025).
     */
    public function testACartOptinIsRefusedADesignThatCapturesSomething(): void
    {
        $refusal = $this->create(Goal::RecoverCart, ['template_id' => 'stacked-signup']);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_metric_mismatch', $refusal->get_error_code());
    }

    /** The mirror: a submit-metered Goal cannot be given the click design. */
    public function testAnEmailOptinIsRefusedADesignThatOnlyLinksAway(): void
    {
        $refusal = $this->create(Goal::GrowEmailList, ['template_id' => 'offer-panel']);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_metric_mismatch', $refusal->get_error_code());
    }

    /** And the pairing the cart Goal is actually for is accepted. */
    public function testACartOptinTakesTheOneStepClickMeteredDesign(): void
    {
        $created = $this->create(Goal::RecoverCart, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);
        $this->assertSame('recover_cart', $created['goal'] ?? null);
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
                'tree' => [
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
                ],
            ],
        ]);

        $this->assertIsArray($created);

        /** @var array<string, mixed> $field */
        $field = $created['config']['template']['tree']['steps'][0]['children'][0];

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
        $tree = [
            'steps' => [
                [
                    'type' => 'stack',
                    'children' => [
                        ['type' => 'field', 'name' => 'phone', 'label' => 'Where do we text it?'],
                    ],
                ],
            ],
        ];

        $roles = \WConvert\Template\SlotRoles::declaredIn($tree, $vocabulary);

        $this->assertContains('phone_label', $roles);
        $this->assertNotContains('email_label', $roles);
    }

    // ========================================================================
    // AND IT HOLDS NO DESTINATION IDS.
    // ========================================================================

    /**
     * *"Its Optins carry no form node, write no [[Lead]], snapshot no
     * [[Consent Record]] and hold no [[Destination]] ids"* (#36). A
     * click-metered Optin captures nothing, so a bound Destination is
     * configuration that can never fire.
     *
     * **Refused rather than stripped**, because stripping writes a decision
     * the merchant did not make and leaves them hunting for a binding that is
     * silently gone.
     */
    public function testAClickMeteredOptinIsRefusedADestination(): void
    {
        $refusal = $this->create(Goal::RecoverCart, [
            'template_id' => 'offer-panel',
            'destinations' => ['01JQ0000000000000000000001'],
        ]);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_captures_nothing', $refusal->get_error_code());
    }

    /** A submit-metered one keeps them, which is the whole point of having them. */
    public function testASubmitMeteredOptinKeepsItsDestinations(): void
    {
        $created = $this->create(Goal::GrowEmailList, [
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
     * **Correcting a Goal is allowed and is checked.** A Goal is persistent,
     * not frozen (CONTEXT.md, Goal) — but re-goaling a form Optin to the cart
     * Goal would leave a form under a click metric, so the correction is asked
     * the same question the create was.
     */
    public function testRegoallingAFormOptinOntoTheCartGoalIsRefused(): void
    {
        $created = $this->create(Goal::GrowEmailList, ['template_id' => 'stacked-signup']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('goal', Goal::RecoverCart->value);
        $request->set_param('config', $created['config']);

        $refusal = $this->controller->update($request);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_metric_mismatch', $refusal->get_error_code());
    }

    /**
     * **And an edit that carries no Goal is checked against the stored one.**
     * Swapping the design alone is the other half of the same mistake, and the
     * PATCH that does it never mentions a Goal at all.
     */
    public function testSwappingInAFormDesignOnACartOptinIsRefused(): void
    {
        $created = $this->create(Goal::RecoverCart, ['template_id' => 'offer-panel']);

        $this->assertIsArray($created);

        $request = new WP_REST_Request();
        $request->set_param('id', $created['id']);
        $request->set_param('config', ['template_id' => 'stacked-signup', 'rules' => [['type' => 'page_load']]]);

        $refusal = $this->controller->update($request);

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_metric_mismatch', $refusal->get_error_code());
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
                'tree' => [
                    'steps' => [
                        [
                            'type' => 'stack',
                            'children' => [
                                ['type' => 'heading', 'role' => 'headline', 'text' => 'Join'],
                                ['type' => 'field', 'name' => 'email', 'label' => 'Email'],
                            ],
                        ],
                    ],
                ],
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

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_cannot_convert', $refusal->get_error_code());
    }

    /**
     * **A config with no design is still saved**, which is the distinction the
     * refusal turns on: a draft mid-creation has no template yet, and refusing
     * one would block the save that is about to add it. What is refused is a
     * design that EXISTS and offers nothing.
     */
    public function testADraftWithNoDesignIsNotCaughtByTheConvertingActCheck(): void
    {
        $this->assertIsArray($this->create(Goal::GrowEmailList, ['template' => ['tree' => ['steps' => []]]]));
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

        $this->assertInstanceOf(WP_Error::class, $refusal);
        $this->assertSame('wconvert_optin_cannot_convert', $refusal->get_error_code());
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
            'rules' => [['type' => 'page_load']],
            'starts_at' => '2026-11-30 09:00',
            'ends_at' => '2026-11-27 09:00',
        ]);

        $this->assertInstanceOf(WP_Error::class, $this->controller->update($request));
    }
}

