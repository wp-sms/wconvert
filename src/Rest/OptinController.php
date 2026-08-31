<?php

namespace WConvert\Rest;

use WConvert\Destination\OptinBinding;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Optin\Frequency;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\Suspension;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Ulid;
use WConvert\Targeting\Targeting;
use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for Optins — create, edit the draft, publish, unpublish, delete.
 *
 * Deliberately thin. The builder, the goal-first creation flow and the
 * analytics screen each arrive in their own ticket; what is here is the
 * surface that makes "an Optin can be created, targeted and published" true,
 * and nothing beyond it.
 *
 * @since 0.1.0
 */
final class OptinController implements RestController
{
    /** A ULID, spelled as a route constraint so a malformed id 404s at the router. */
    private const ID_PATTERN = '(?P<id>' . Ulid::PATTERN . ')';

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly RuleVocabulary $vocabulary,
        private readonly TemplateVocabulary $templates,
        private readonly TemplateLibrary $library,
        private readonly GoalRegistry $goals,
        private readonly PublishedSet $publishedSet,
        private readonly Degradation $degradation,
        private readonly RuleCatalogue $rules,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/optins', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'include_deleted' => ['type' => 'boolean', 'default' => false],
                ],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'store'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'name' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                    'goal' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key'],
                    'config' => ['type' => 'object', 'default' => []],
                ],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/optins/' . self::ID_PATTERN, [
            [
                'methods' => 'GET',
                'callback' => [$this, 'show'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'PUT, PATCH',
                'callback' => [$this, 'update'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'name' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                    'goal' => ['type' => 'string', 'sanitize_callback' => 'sanitize_key'],
                    'config' => ['type' => 'object'],
                ],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [$this, 'destroy'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);

        // Publishing is its own route rather than a `status` field on the
        // update above. It is not an attribute of the Optin being edited — it
        // promotes one column onto another and rebuilds the published set, and
        // a PATCH that happens to carry `status: published` hides that.
        register_rest_route(Routes::NAMESPACE, '/optins/' . self::ID_PATTERN . '/publish', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'publish'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/optins/' . self::ID_PATTERN . '/unpublish', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'unpublish'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);
    }

    /**
     * The list, with [[Suspended]] resolved for every published row.
     *
     * ========================================================================
     * SUSPENSION IS COMPUTED HERE, AND STORED NOWHERE (ADR 0027).
     * ========================================================================
     * It is a pure function of what the site is SERVING against the live
     * registry, so it is read off the published set — one non-autoloaded
     * option the front end already reads whole — rather than off the two
     * LONGTEXT columns the summary projection exists to avoid dragging
     * (ADR 0001). That also makes it the same input the enqueue path resolves,
     * so the list cannot say "running" about an Optin the payload is leaving
     * out.
     *
     * A column would drift the moment [[Pro]] was deactivated without anything
     * republishing, which is precisely the event it would be recording.
     */
    public function index(WP_REST_Request $request): WP_REST_Response
    {
        $summaries = $this->optins->summaries((bool) $request->get_param('include_deleted'));
        $suspended = Suspension::reasonsIn($this->publishedSet->all(), $this->degradation, $this->rules);

        return new WP_REST_Response(array_map(
            // Present on every row, including as null. A key that appears only
            // on the bad rows is a key the client tests for existence, and
            // "absent" and "not suspended" would then be one thing that the
            // day a request half-fails become two.
            static fn (array $row): array => $row + ['suspended' => $suspended[$row['id'] ?? ''] ?? null],
            $summaries
        ));
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function show(WP_REST_Request $request)
    {
        $optin = $this->optins->find((string) $request->get_param('id'));

        return $optin === null ? self::notFound() : new WP_REST_Response($optin->toArray());
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function store(WP_REST_Request $request)
    {
        $goal = RequestedGoal::settable($this->goals, (string) $request->get_param('goal'));

        if ($goal instanceof WP_Error) {
            return $goal;
        }

        $config = (array) $request->get_param('config');

        // A create has no stored row to compare against, so the config that
        // arrived IS the prior state: one carrying a design beside the id it
        // names already holds its copy. That is exactly what prefill hands
        // back — the Template's design with a [[Playbook]]'s words written
        // into it — and re-snapshotting would take the words straight back
        // out, which is a blank popup and a merchant who watched it happen.
        $normalized = $this->normalizeConfig($config, self::optionalString($config['template_id'] ?? null));

        if (!$this->vocabulary->hasTrigger($normalized['rules'] ?? [])) {
            return self::needsATrigger();
        }

        $refusal = self::refuseAMetricItCannotReport($normalized, $goal)
            ?? self::refuseADesignThatCannotConvert($normalized);

        if ($refusal !== null) {
            return $refusal;
        }

        $optin = $this->optins->create((string) $request->get_param('name'), $goal->value, $normalized);

        return new WP_REST_Response($optin->toArray(), 201);
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function update(WP_REST_Request $request)
    {
        $config = $request->get_param('config');
        $id = (string) $request->get_param('id');
        $goal = self::optionalString($request->get_param('goal'));

        // **A Goal is persistent, not frozen** (CONTEXT.md, Goal). Correcting
        // one is allowed and is the case ADR 0020 exists for — the counters
        // carry no `goal`, so the correction restates the Optin's whole
        // history rather than splitting it at the moment of the edit. What is
        // checked is the Goal being SET, never the one already held: an Optin
        // whose Goal became unavailable when WooCommerce was deactivated keeps
        // it, and keeps every number it already counted (ADR 0026).
        $checked = $goal === null ? null : RequestedGoal::settable($this->goals, $goal);

        if ($checked instanceof WP_Error) {
            return $checked;
        }

        // The stored row, read ONCE. Two things below are asked of it — which
        // Template the config was taken for, and which Goal this Optin holds —
        // and reading it twice would pull a LONGTEXT column twice per edit to
        // answer two questions about the same row.
        $stored = $this->optins->find($id);

        // Which Template the copy in `config` was TAKEN FOR, so that repicking
        // one takes a fresh copy while editing anything else leaves the copy
        // the merchant has been editing alone. On an update that is the stored
        // row; on a create it is whatever the incoming config asserts, because
        // there is no stored row yet ({@see self::store()}).
        $pickedBefore = self::optionalString($stored?->config['template_id'] ?? null);

        $normalized = is_array($config) ? $this->normalizeConfig($config, $pickedBefore) : null;

        // Checked against the config that ARRIVED, because `saveDraft()`
        // replaces the blob whole — a PATCH carrying `config` is the new
        // config, so a trigger the stored one had is not one this Optin will
        // have. A PATCH that carries none is not editing the rules at all and
        // is not asked the question.
        if ($normalized !== null && !$this->vocabulary->hasTrigger($normalized['rules'] ?? [])) {
            return self::needsATrigger();
        }

        // Against the Goal this Optin will HAVE — the corrected one where the
        // PATCH carries one, and the stored one where it does not. Reading the
        // stored Goal is what makes editing a design on an Optin nobody is
        // re-goaling still answerable.
        $held = $checked ?? ($stored === null ? null : Goal::tryFrom($stored->goal));
        $refusal = $normalized === null
            ? null
            : (($held === null ? null : self::refuseAMetricItCannotReport($normalized, $held))
                ?? self::refuseADesignThatCannotConvert($normalized));

        if ($refusal !== null) {
            return $refusal;
        }

        $optin = $this->optins->saveDraft(
            $id,
            self::optionalString($request->get_param('name')),
            $checked?->value,
            $normalized
        );

        return $optin === null ? self::notFound() : new WP_REST_Response($optin->toArray());
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function publish(WP_REST_Request $request)
    {
        return self::respond($this->optins->publish((string) $request->get_param('id')));
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function unpublish(WP_REST_Request $request)
    {
        return self::respond($this->optins->unpublish((string) $request->get_param('id')));
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function destroy(WP_REST_Request $request)
    {
        if (!$this->optins->delete((string) $request->get_param('id'))) {
            return self::notFound();
        }

        // 200 with the soft-deleted Optin, not 204. It still exists — deleting
        // an Optin is a `deleted_at` stamp, because analytics interprets its
        // conversion counts by joining this table at read (ADR 0020).
        return self::respond($this->optins->find((string) $request->get_param('id')));
    }

    /**
     * Drop every rule this install's vocabulary does not know, on the way in —
     * on all three axes.
     *
     * ADR 0005's vocabulary is closed, so an unrecognised rule is a mistake
     * rather than an extension — and one caught at write is one that cannot be
     * published later into a payload nothing can evaluate. The flat client
     * list stays flat here: it is split into `triggers` and `conditions` at
     * PUBLISH time, which is a different moment and a different file.
     *
     * @param array<string, mixed> $config
     * @param string|null $pickedBefore The Template the copy in `$config` was taken for.
     * @return array<string, mixed>
     */
    private function normalizeConfig(array $config, ?string $pickedBefore = null): array
    {
        if (isset($config['targeting'])) {
            $config['targeting'] = Targeting::fromArray((array) $config['targeting'])->toArray();
        }

        if (isset($config['rules'])) {
            $config['rules'] = $this->vocabulary->normalize($config['rules']);
        }

        // **The allowance, which reached the browser unvalidated until now.**
        // The loader has honoured all four fields since #3 and nothing has
        // ever written them, so `frequency` travelled out of the config blob
        // exactly as the client sent it. Rounded through the value object the
        // same way `targeting` is, one branch up.
        //
        // The KEY IS UNSET when nothing was set, rather than stored as `[]`.
        // An empty object is bytes on every matching page view that cannot
        // change an answer, and the payload is inlined against a 2KB budget
        // (ADR 0014).
        if (isset($config['frequency'])) {
            $frequency = Frequency::fromArray((array) $config['frequency'])->toArray();

            if ($frequency === []) {
                unset($config['frequency']);
            } else {
                $config['frequency'] = $frequency;
            }
        }

        // **Priority, and absent IS zero.** `arbitrate()` reads `priority ?? 0`
        // when it sorts overlays, so a stored 0 and no key at all are the same
        // rule — and the one that costs nothing on every page view is the one
        // to store. Negatives are kept: a merchant deliberately pushing one
        // Optin behind the rest has said something, and clamping it would
        // silently make two Optins tie.
        if (isset($config['priority'])) {
            $priority = is_numeric($config['priority']) ? (int) $config['priority'] : 0;

            if ($priority === 0) {
                unset($config['priority']);
            } else {
                $config['priority'] = $priority;
            }
        }

        // **[[Destination]] ids and nothing more** (CONTEXT.md, Destination).
        // Normalised on the way in like everything else here: a Destination's
        // audience, tags and field map live on the Destination, so anything
        // that is not an id in this list is a second configuration surface
        // arriving by the back door.
        if (isset($config[OptinBinding::KEY])) {
            $config[OptinBinding::KEY] = OptinBinding::ids($config);
        }

        // Picking a Template TAKES A COPY of its design here — the tree with
        // every word taken out of it, since a Template carries no copy
        // (CONTEXT.md, Template). An Optin already holding a copy of the
        // Template it names keeps it, so improving the entry never restyles a
        // running Optin and deleting it leaves the Optin working; picking a
        // DIFFERENT one takes a fresh copy, because otherwise `template_id`
        // would say one design and the payload would render another
        // (ADR 0010).
        $config = $this->library->snapshotInto($config, $pickedBefore);

        if (isset($config['template'])) {
            // Validated on the way IN, which is what replaces `wp_kses` for a
            // template: there is no HTML and no CSS to sanitise, so what is
            // left to enforce is that every node, token, param and Slot Role
            // is one the vocabulary declares.
            $config['template'] = $this->templates->normalize($config['template']);
        }

        return $config;
    }

    /**
     * @param mixed $value
     */
    private static function optionalString($value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    private static function respond(?Optin $optin)
    {
        return $optin === null ? self::notFound() : new WP_REST_Response($optin->toArray());
    }

    /**
     * **An Optin cannot be saved with no [[Trigger]] it can act on.**
     *
     * Every Optin has at least one, and "shows immediately" is the explicit
     * `page_load` Trigger rather than an empty list (CONTEXT.md, Trigger). An
     * Optin with none can never fire — a silent, total loss of function with
     * nothing in any log, which ADR 0012 names as this category's defining
     * support ticket.
     *
     * Refused rather than repaired. Supplying `page_load` for the merchant
     * would put a popup on the page the moment it loads, which is display
     * behaviour nobody asked for — the same reason ADR 0012 refuses to invent
     * a substitute for a dropped [[Condition]], and the reason the [[Playbook]]
     * registry refuses the same shape at the other end (
     * {@see \WConvert\Support\RejectionReason::NoTrigger}).
     *
     * Refused at SAVE rather than at publish, because the draft is what the
     * merchant is looking at: told at publish, they would have to find their
     * way back to a rules panel they had already left.
     */
    /**
     * ========================================================================
     * A DESIGN THAT REPORTS NOTHING FOR THE GOAL IT IS FILED UNDER IS REFUSED
     * AT THE WRITE, NOT ONLY ON THE SCREEN.
     * ========================================================================
     * **One Optin has exactly one converting act, and its [[Goal]] decides
     * which** (CONTEXT.md, Conversion). Paired the wrong way round the Optin
     * reports nothing at all: the Goal counts a submission and the design
     * offers a click, so the analytics screen reads zero forever and looks
     * broken while being right.
     *
     * {@see \WConvert\Playbook\PlaybookLibrary} asks this of a [[Playbook]]
     * at registration and {@see \WConvert\Template\TemplateLibrary} asks it
     * of a [[Template]], but **neither is an enforcement mechanism for an
     * Optin**: `POST /wconvert/v1/optins` takes a whole design in `config`
     * and is scriptable by anyone holding `manage_options`. That is the same
     * argument ADR 0026 already made about the goal screen — "a screen is not
     * an enforcement mechanism" — applied to the other half of the pairing.
     *
     * Without it, `{goal: 'recover_cart', template_id: 'stacked-signup'}` is
     * accepted: a cart Optin with a form on it, which ADR 0025 says is not
     * merely unnecessary but **forbidden**, since a click-metered Optin
     * carrying a form emits [[Lead]]s that are not [[Conversion]]s.
     *
     * **A design offering nothing is not refused.** A draft mid-creation has
     * no template yet, and refusing one would block the save that is about to
     * add it. What is refused is a design that offers the WRONG act, or both.
     *
     * @param array<string, mixed> $config Already normalised.
     */
    private static function refuseAMetricItCannotReport(array $config, Goal $goal): ?WP_Error
    {
        $offered = ConvertingAct::offeredIn($config['template']['tree'] ?? null);

        if ($offered !== [] && $offered !== [$goal->convertingAct()]) {
            return new WP_Error(
                'wconvert_optin_metric_mismatch',
                sprintf(
                    /* translators: %s: the name of the Goal the Optin is filed under. */
                    __(
                        // **It names no door the merchant cannot reach.** This
                        // said "…or change the Goal", and nothing in the
                        // builder changes a Goal — it is chosen at creation. The
                        // gallery marks which designs match before the click
                        // now, so a merchant meets this only through a scripted
                        // call, where the fact is what matters and the
                        // instruction is noise.
                        'This design does not produce the outcome “%s” counts, so the Optin would report nothing. Pick a design that matches the Goal.',
                        'wconvert'
                    ),
                    $goal->label()
                ),
                ['status' => 400]
            );
        }

        // **A click-metered Optin holds no [[Destination]] ids** (ADR 0025).
        // It captures nothing, so there is no Lead to push and a bound
        // Destination is configuration that can never fire — refused rather
        // than stripped, because stripping writes a decision the merchant did
        // not make and leaves them looking for a binding that is silently
        // gone.
        if ($goal->convertingAct() === ConvertingAct::Click && ($config[OptinBinding::KEY] ?? []) !== []) {
            return new WP_Error(
                'wconvert_optin_captures_nothing',
                sprintf(
                    /* translators: %s: the name of the Goal the Optin is filed under. */
                    __(
                        '“%s” is measured by a click and captures nothing, so it has no leads to send anywhere. Remove its destinations first.',
                        'wconvert'
                    ),
                    $goal->label()
                ),
                ['status' => 400]
            );
        }

        return null;
    }

    /**
     * ========================================================================
     * A DESIGN THAT OFFERS NO CONVERTING ACT AT ALL IS REFUSED AT THE WRITE.
     * ========================================================================
     * **This is the hole the structure editor opens, closed on the same day it
     * opens.**
     *
     * {@see TemplateLibrary::refuse()} already refuses a Template offering no
     * converting act — but it refuses it **at registration**, of a library
     * entry read from a JSON file, and it has never applied to an Optin's own
     * `config`. It did not need to. Before the structure editor there was no
     * way for an Optin's tree to lose its button: the settings panel could not
     * remove a node (ADR 0010), and `hidden` is not a param `button` declares,
     * so hiding it was inexpressible rather than merely disallowed.
     *
     * An editor that can delete closes neither door. Deleting the only button
     * leaves an Optin that renders, publishes, shows, and reports **zero
     * forever** — ADR 0020's exact failure, the one that looks broken while
     * being right — and nothing in this path refused it.
     *
     * The editor refuses it first ({@see whyRemovalIsRefused} in
     * `builder/structure/guards.ts`), and that is not the enforcement. `PUT
     * /wconvert/v1/optins/{id}` takes a whole `config` and is scriptable by
     * anyone holding `manage_options`, which is the same argument ADR 0026
     * made about the goal screen — *"a screen is not an enforcement
     * mechanism"* — and the reason
     * {@see self::refuseAMetricItCannotReport()} exists one method up.
     *
     * **A config with no design is still not refused**, exactly as above: a
     * draft mid-creation has no template yet, and refusing one would block the
     * save that is about to add it. What is refused is a design that EXISTS
     * and offers nothing — steps that render, with no act among them.
     *
     * It asks no Goal, deliberately. "Reports nothing at all" is wrong under
     * every Goal, including one this install can no longer resolve, so making
     * the check depend on a Goal would let it lapse on precisely the rows
     * ADR 0026 keeps working.
     *
     * @param array<string, mixed> $config Already normalised.
     */
    private static function refuseADesignThatCannotConvert(array $config): ?WP_Error
    {
        $steps = $config['template']['tree']['steps'] ?? null;

        if (!is_array($steps) || $steps === []) {
            return null;
        }

        if (ConvertingAct::offeredIn($config['template']['tree']) !== []) {
            return null;
        }

        return new WP_Error(
            'wconvert_optin_cannot_convert',
            __(
                'This design has nothing on it that counts as a conversion, so the Optin would report zero however many people saw it. Add the button back, or pick a design that has one.',
                'wconvert'
            ),
            ['status' => 400]
        );
    }

    private static function needsATrigger(): WP_Error
    {
        return new WP_Error(
            'wconvert_optin_needs_a_trigger',
            __(
                'An Optin needs at least one Trigger it can act on. Fill in the one you have, or add “Shows immediately” if it should show straight away.',
                'wconvert'
            ),
            ['status' => 400]
        );
    }

    private static function notFound(): WP_Error
    {
        return new WP_Error('wconvert_optin_not_found', __('No such Optin.', 'wconvert'), ['status' => 404]);
    }
}
