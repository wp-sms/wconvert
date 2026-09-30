<?php

namespace WConvert\Rest;

use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Playbook\FlagshipCollection;
use WConvert\Playbook\Playbook;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Goal-scoped metadata, bounded prepared previews, and read-only draft preparation. */
final class PlaybookController implements RestController
{
    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly GoalRegistry $goals,
        private readonly Prefill $prefill,
        private readonly \WConvert\Discovery\SetupIndex $setups,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/playbooks', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'goal' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key'],
                ],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/playbooks/previews', [[
            'methods' => 'GET', 'callback' => [$this, 'previews'],
            'permission_callback' => [Routes::class, 'canManage'],
            'args' => ['goal' => ['required' => true, 'type' => 'string'], 'ids' => ['required' => true, 'type' => 'string']],
        ]]);

        // Its own route rather than a parameter on the gallery above, because
        // it answers a different question: the gallery is what a merchant is
        // choosing BETWEEN, and this is the one they chose. Registered before
        // nothing and after nothing — `prefill` is not a ULID, so it cannot
        // collide with an id route.
        register_rest_route(Routes::NAMESPACE, '/playbooks/prefill', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'draft'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'goal' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key'],
                    // Absent means "start from scratch", which skips the
                    // Playbook and never the Goal.
                    'playbook_id' => ['type' => 'string', 'sanitize_callback' => 'sanitize_key'],
                    'revision' => ['type' => 'string'],
                    'prepared_revision' => ['type' => 'string'],
                ],
            ],
        ]);
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function index(WP_REST_Request $request)
    {
        $goal = $this->goal($request);

        if ($goal instanceof WP_Error) {
            return $goal;
        }

        return new WP_REST_Response(array_map(
            fn (Playbook $playbook): array => $this->metadata($playbook),
            FlagshipCollection::prioritize($this->playbooks->servicing($goal))
        ));
    }

    /** @return array<string, mixed> */
    private function metadata(Playbook $playbook): array
    {
        $entry = $this->setups->entry($playbook);
        $recommendation = FlagshipCollection::recommendation($playbook->id);
        if ($recommendation !== null) $entry['recommendation'] = $recommendation;
        return $entry;
    }

    public function previews(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $goal = $this->goal($request);
        if ($goal instanceof WP_Error) return $goal;
        $ids = array_values(array_unique(explode(',', (string) $request->get_param('ids'))));
        if (count($ids) > 24) return new WP_Error('wconvert_preview_limit', __('Ask for at most 24 previews.', 'wconvert'), ['status' => 400]);
        $entries = [];
        foreach ($ids as $id) {
            $playbook = $this->playbooks->find($id);
            if ($playbook === null || $playbook->goal !== $goal) continue;
            if ($this->metadata($playbook)['availability'] !== 'ready') continue;
            $entries[] = $this->withItsDesign($playbook);
        }
        return new WP_REST_Response(['entries' => $entries]);
    }

    /** Actual Prefill output, requested only for visible cards or inspection.
     * @return array<string, mixed>
     */
    private function withItsDesign(Playbook $playbook): array
    {
        $entry = $this->metadata($playbook);
        $recommendation = FlagshipCollection::recommendation($playbook->id);
        if ($recommendation !== null) {
            $entry['recommendation'] = $recommendation;
        }
        $draft = $this->prefill->fromPlaybook($playbook->id);
        $entry['prepared_revision'] = hash('sha256', json_encode($draft, JSON_THROW_ON_ERROR));
        $config = $draft['config'] ?? null;
        $template = $config['template'] ?? null;

        // Summaries must describe the same resolved settings the editor gets,
        // not the authored rules before installation-specific degradation.
        // This is a subset of the existing Prefill result, not another prefill.
        if (is_array($config)) {
            $entry['setup'] = array_intersect_key($config, array_flip([
                'display_type', 'display_rules', 'targeting', 'frequency', 'destination_hint',
            ]));
        }

        // Keep the preview shape explicit. Unavailable designs are omitted by
        // the caller and cannot start an Optin through the draft endpoint.
        if (is_array($template)) {
            $entry['template'] = $template;
        }

        return $entry;
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function draft(WP_REST_Request $request)
    {
        $goal = $this->goal($request);

        if ($goal instanceof WP_Error) {
            return $goal;
        }

        $playbookId = (string) $request->get_param('playbook_id');

        if ($playbookId === '') {
            return new WP_REST_Response($this->prefill->fromScratch($goal));
        }

        $playbook = $this->playbooks->find($playbookId);
        if ($playbook !== null) {
            $entry = $this->metadata($playbook);
            if ($entry['availability'] !== 'ready') return new WP_Error('wconvert_setup_unavailable', __('This design is not available on this site.', 'wconvert'), ['status' => 409]);
            $revision = $request->get_param('revision');
            if (is_string($revision) && !hash_equals($entry['revision'], $revision)) return new WP_Error('wconvert_setup_changed', __('This setup changed. Preview it again before creating a draft.', 'wconvert'), ['status' => 409]);
        }
        $draft = $this->prefill->fromPlaybook($playbookId);

        if ($draft === null) {
            return new WP_Error('wconvert_playbook_not_found', __('No such Campaign setup.', 'wconvert'), ['status' => 404]);
        }

        // The Playbook has to serve the Goal that was asked for. A mismatch is
        // a client that lost track of which screen it was on, and answering it
        // would hand back a draft under a Goal the merchant did not choose —
        // and the Goal is the one thing chosen before anything else.
        if ($draft['goal'] !== $goal->value) {
            return new WP_Error(
                'wconvert_playbook_serves_another_goal',
                __('That Campaign setup does not serve that Goal.', 'wconvert'),
                ['status' => 400]
            );
        }

        $preparedRevision = $request->get_param('prepared_revision');
        if (is_string($preparedRevision) && !hash_equals(hash('sha256', json_encode($draft, JSON_THROW_ON_ERROR)), $preparedRevision)) {
            return new WP_Error('wconvert_prepared_setup_changed', __('Site settings changed this setup. Reload its preview before creating a draft.', 'wconvert'), ['status' => 409]);
        }

        return new WP_REST_Response($draft);
    }

    /**
     * The requested Goal, or the error that says why it is not one.
     *
     * Shared with {@see OptinController} through {@see RequestedGoal}, so the
     * two cannot answer the same question with two different statuses —
     * which they did, and a client could not tell from the code what had
     * happened. Prefilling under a Goal this install cannot serve would in any
     * case produce a draft that `POST /optins` then refuses.
     *
     * @return Goal|WP_Error
     */
    private function goal(WP_REST_Request $request)
    {
        return RequestedGoal::settable($this->goals, (string) $request->get_param('goal'));
    }
}
