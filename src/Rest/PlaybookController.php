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
final class PlaybookController implements RestController
{
    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly GoalRegistry $goals,
        private readonly Prefill $prefill,
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
            fn (Playbook $playbook): array => $this->withItsDesign($playbook),
            FlagshipCollection::prioritize($this->playbooks->servicing($goal))
        ));
    }

    /**
     * One Playbook, and **the design it would prefill, with its words in it**.
     *
     * ========================================================================
     * STEP 2 DREW A HEADING, A PARAGRAPH AND A BUTTON (#68, #79).
     * ========================================================================
     * The creation flow's second step is where a merchant chooses between
     * ready-to-run starts, and it showed them as `ChoiceCard`s — while the
     * product's whole claim is that there are no thumbnails anywhere in this
     * flow because the REAL thing is cheap to draw (ADR 0010). The chooser now renders the real design and opens its draft directly.
     *
     * `Playbook::toArray()` carries `template_id`, `display_type` and `copy`
     * and nothing has ever read them, because none of the three is a design:
     * binding copy to [[Slot Role]]s is {@see Prefill}'s job and reproducing it
     * in the browser would be a second implementation of the one thing that
     * must not have two.
     *
     * **So this is prefill's own composition, called here.** What the chooser draws
     * is byte-identical to what `POST /optins` would store — not similar to it, the same call — so a merchant cannot be shown
     * a card and then handed something else.
     *
     * The cost is one tree per Playbook on a route that returns the handful
     * servicing one [[Goal]]. That is a different question from the design
     * LIBRARY, which is indexed precisely because it is not a handful
     * (ADR 0043).
     *
     * @return array<string, mixed>
     */
    private function withItsDesign(Playbook $playbook): array
    {
        $entry = $playbook->toArray();
        $recommendation = FlagshipCollection::recommendation($playbook->id);
        if ($recommendation !== null) {
            $entry['recommendation'] = $recommendation;
        }
        $draft = $this->prefill->fromPlaybook($playbook->id);
        $config = $draft['config'] ?? null;
        $template = $config['template'] ?? null;

        // Summaries must describe the same resolved settings the editor gets,
        // not the authored rules before installation-specific degradation.
        // This is a subset of the existing Prefill result, not another prefill.
        if (is_array($config)) {
            $entry['setup'] = array_intersect_key($config, array_flip([
                'display_type', 'rules', 'targeting', 'frequency', 'destination_hint',
            ]));
        }

        // Absent rather than empty where there is no design behind it: a
        // Playbook naming a Template this install no longer ships still starts
        // an Optin, and the card falls back to the words it always had.
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
