<?php

namespace WConvert\Rest;

use WConvert\Destination\OptinBinding;
use WConvert\Goal\GoalRegistry;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Ulid;
use WConvert\Targeting\Targeting;
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
final class OptinController
{
    /** A ULID, spelled as a route constraint so a malformed id 404s at the router. */
    private const ID_PATTERN = '(?P<id>' . Ulid::PATTERN . ')';

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly RuleVocabulary $vocabulary,
        private readonly TemplateVocabulary $templates,
        private readonly TemplateLibrary $library,
        private readonly GoalRegistry $goals,
    ) {
    }

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
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

    public function index(WP_REST_Request $request): WP_REST_Response
    {
        return new WP_REST_Response($this->optins->summaries((bool) $request->get_param('include_deleted')));
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

        // Which Template the copy in `config` was TAKEN FOR, so that repicking
        // one takes a fresh copy while editing anything else leaves the copy
        // the merchant has been editing alone. On an update that is the stored
        // row; on a create it is whatever the incoming config asserts, because
        // there is no stored row yet ({@see self::store()}).
        $pickedBefore = self::optionalString($this->optins->find($id)?->config['template_id'] ?? null);

        $normalized = is_array($config) ? $this->normalizeConfig($config, $pickedBefore) : null;

        // Checked against the config that ARRIVED, because `saveDraft()`
        // replaces the blob whole — a PATCH carrying `config` is the new
        // config, so a trigger the stored one had is not one this Optin will
        // have. A PATCH that carries none is not editing the rules at all and
        // is not asked the question.
        if ($normalized !== null && !$this->vocabulary->hasTrigger($normalized['rules'] ?? [])) {
            return self::needsATrigger();
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
