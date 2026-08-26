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
}
