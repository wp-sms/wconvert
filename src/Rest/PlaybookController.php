<?php

namespace WConvert\Rest;

use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Playbook\Playbook;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the [[Playbook]] gallery, and for prefill.
 *
 * **Read-only, and prefill persists nothing.** Both routes are `GET`, which is
 * not a formality: a merchant who browses the gallery, prefills three drafts
 * and closes the tab has created nothing. What prefill returns is the body
 * `POST /wconvert/v1/optins` takes, and until someone posts it there is no
 * row.
 *
 * **The gallery filters on Goal only.** [[Display Type]] is not the primary
 * axis of the product — users arrive via a Goal, and the type is prefilled by
 * the chosen Playbook, selectable as an override and a filter afterwards
 * (CONTEXT.md, Display Type). Adding a second filter parameter here would make
 * it one.
 *
 * @since 0.1.0
 */
final class PlaybookController
{
    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly GoalRegistry $goals,
        private readonly Prefill $prefill,
    ) {
    }

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
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
            static fn (Playbook $playbook): array => $playbook->toArray(),
            $this->playbooks->servicing($goal)
        ));
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

        $draft = $this->prefill->fromPlaybook($playbookId);

        if ($draft === null) {
            return new WP_Error('wconvert_playbook_not_found', __('No such Playbook.', 'wconvert'), ['status' => 404]);
        }

        // The Playbook has to serve the Goal that was asked for. A mismatch is
        // a client that lost track of which screen it was on, and answering it
        // would hand back a draft under a Goal the merchant did not choose —
        // and the Goal is the one thing chosen before anything else.
        if ($draft['goal'] !== $goal->value) {
            return new WP_Error(
                'wconvert_playbook_serves_another_goal',
                __('That Playbook does not serve that Goal.', 'wconvert'),
                ['status' => 400]
            );
        }

        return new WP_REST_Response($draft);
    }

    /**
     * The requested Goal, or the error that says why it is not one.
     *
     * A Goal this install cannot serve is refused rather than served empty:
     * the goal screen never offers it, so a request naming it did not come
     * from the flow, and prefilling under it would produce a draft that
     * `POST /optins` then refuses.
     *
     * @return Goal|WP_Error
     */
    private function goal(WP_REST_Request $request)
    {
        $goal = Goal::tryFrom((string) $request->get_param('goal'));

        if ($goal === null) {
            return new WP_Error('wconvert_goal_not_found', __('No such Goal.', 'wconvert'), ['status' => 404]);
        }

        if (!$this->goals->isSettable($goal)) {
            return new WP_Error(
                'wconvert_goal_unavailable',
                __('This install cannot serve that Goal.', 'wconvert'),
                ['status' => 400]
            );
        }

        return $goal;
    }
}
