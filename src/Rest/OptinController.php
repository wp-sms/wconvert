<?php

namespace WConvert\Rest;

use WConvert\Destination\OptinBinding;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Milestone\FirstEdit;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\DisplayType;
use WConvert\Optin\Frequency;
use WConvert\Optin\InvalidSchedule;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Optin\Schedule;
use WConvert\Optin\SiteFrequency;
use WConvert\Optin\Suspension;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatDay;
use WConvert\Support\Ulid;
use WConvert\Targeting\Targeting;
use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateFacets;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Template\TemplateTree;
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
        private readonly SiteFrequency $siteFrequency,
        private readonly MilestoneStore $milestones,
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

        // ====================================================================
        // THE ALLOWANCE THE WHOLE SITE SHARES — ONE SETTING, NOT AN OPTIN'S.
        // ====================================================================
        // Declared BEFORE `/optins/<ulid>` for readability rather than for
        // routing: `frequency` is not 26 characters of Crockford base32, so
        // the id pattern below cannot match it and the two can never be
        // confused. It sits under `/optins` because that is what it is about —
        // how often this device may be shown ANY of them.
        //
        // A route rather than a field on each Optin, because an Optin cannot
        // opt out of it: a per-Optin *ignore the site setting* is the
        // configuration two scopes exist to delete (ADR 0047).
        register_rest_route(Routes::NAMESPACE, '/optins/frequency', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'showSiteFrequency'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'updateSiteFrequency'],
                'permission_callback' => [Routes::class, 'canManage'],
                // No `args` schema and no defaults, deliberately. All four
                // fields default OFF at this scope, so a REST default of
                // `true` on either switch would turn a site-wide cap on for
                // anybody whose client omitted a key. What the body says is
                // normalised by {@see SiteFrequency}, which is the one place
                // this scope's reading of an absent key lives.
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
                    'template_source' => ['type' => 'string'],
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
        $includeDeleted = (bool) $request->get_param('include_deleted');

        $summaries = $this->optins->summaries($includeDeleted);
        $suspended = Suspension::reasonsIn($this->publishedSet->all(), $this->degradation, $this->rules);

        // ====================================================================
        // AND THE ARMS, NESTED — THE OTHER HALF OF ADR 0045'S LIST.
        // ====================================================================
        // The `WHERE` above is the filter half and was built ahead of the
        // feature; this is the read that draws each test's arms beneath their
        // parent, so a merchant running three tests meets three campaigns
        // rather than six.
        //
        // **One statement for every arm on the install**, grouped in PHP —
        // 500 parents would otherwise be 500 round trips to draw one screen,
        // and the grouping is the same join {@see \WConvert\Stats\Dashboard}
        // performs for the same reason (ADR 0034).
        $arms = $this->optins->armsByParent($includeDeleted);

        $describe = static fn (array $row): array => array_replace($row, [
            'suspended' => $suspended[$row['id'] ?? ''] ?? null,
            'has_unpublished_changes' => (bool) ($row['has_unpublished_changes'] ?? false),
        ]);

        return new WP_REST_Response(array_map(
            // Present on every row, including as null and as an empty list. A
            // key that appears only on the interesting rows is a key the client
            // tests for existence, and "absent" and "not suspended" — or
            // "absent" and "running no test" — would then be one thing that the
            // day a request half-fails become two.
            static fn (array $row): array => $describe($row) + [
                'arms' => array_map($describe, $arms[(string) ($row['id'] ?? '')] ?? []),
            ],
            $summaries
        ));
    }

    /**
     * One Optin, whole — **with [[Suspended]] resolved, exactly as the list
     * resolves it.**
     *
     * The builder's readiness panel is the one place an editor says whether
     * this Optin is on the site, and `published_at` alone cannot answer that: a
     * suspended Optin IS published and is on no page at all (CONTEXT.md,
     * Suspended). A panel reading the column would say *"Live"* about an Optin
     * the site is holding back, which is worse than saying nothing — and worse
     * than the list, which has said the true thing since ADR 0027.
     *
     * Computed and stored nowhere, off the same published set {@see self::index()}
     * reads, so the two screens cannot disagree about one row. The key is
     * present including as null, for the reason the list's is: a key that
     * appeared only on the bad rows is a key the client tests for existence,
     * and "absent" and "not suspended" would be one thing until a request
     * half-failed.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function show(WP_REST_Request $request)
    {
        $optin = $this->optins->find((string) $request->get_param('id'));

        if ($optin === null) {
            return self::notFound();
        }

        $suspended = Suspension::reasonsIn($this->publishedSet->all(), $this->degradation, $this->rules);

        return new WP_REST_Response($optin->toArray() + [
            'suspended' => $suspended[$optin->id] ?? null,
            'sibling_act' => $this->actOfTheOtherArms($optin->id)?->value,
        ]);
    }

    /**
     * What the other arms of this Optin's test convert on, or null.
     *
     * ========================================================================
     * THE ONE FACT THE BUILDER CANNOT READ OFF THE OPTIN IT IS EDITING.
     * ========================================================================
     * An arm's design has to convert the same way as its siblings', or the
     * test compares a submission rate against a click rate — and the write
     * refuses that ({@see self::refuseAnArmMeteredDifferently()}). The picker
     * marks it BEFORE the click (ADR 0042 rule 3), and to do that it needs the
     * siblings' act, which lives in their `config` and nowhere the builder can
     * see.
     *
     * Resolved here rather than in a route of its own, beside `suspended`,
     * which is the same shape and the same reason: a fact about this Optin's
     * place in the install that its own row cannot answer.
     *
     * **Null on an Optin that is not part of a test**, which is almost all of
     * them and costs them the one query
     * {@see OptinRepository::otherArmsOf()} makes and nothing more. Null too
     * where the siblings disagree with each other — a state the write refuses,
     * so reaching it means a hand-edited row, and marking cards against one of
     * two answers would be marking them against a guess.
     *
     * ========================================================================
     * ONE READING, AND THE REFUSAL BELOW SHARES IT.
     * ========================================================================
     * This walk and {@see self::refuseAnArmMeteredDifferently()} both answer
     * *"what do the other arms convert on"*, and they were written twice —
     * which is the two-sources-can-disagree shape this whole ticket deleted
     * from {@see Goal}, arriving one file over. The picker marks a card
     * against this answer and the save refuses against that one, so any daylight
     * between them is a card the merchant is allowed to press and then refused.
     *
     * So there is one method and both callers take it. It also settles the
     * hand-edited case the same way in both places: siblings that disagree with
     * each other answer null, and null refuses nothing rather than refusing
     * against whichever row was read first.
     */
    private function actOfTheOtherArms(string $id): ?ConvertingAct
    {
        $found = null;

        foreach ($this->optins->otherArmsOf($id) as $arm) {
            $theirs = ConvertingAct::offeredIn($arm->config['template']['tree'] ?? null);

            if (count($theirs) !== 1) {
                continue;
            }

            if ($found !== null && $found !== $theirs[0]) {
                return null;
            }

            $found = $theirs[0];
        }

        return $found;
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
        $choiceRefusal = $this->refuseMalformedChoices($config['template'] ?? null);
        if ($choiceRefusal !== null) {
            return $choiceRefusal;
        }

        // A create has no stored row to compare against, so the config that
        // arrived IS the prior state: one carrying a design beside the id it
        // names already holds its copy. That is exactly what prefill hands
        // back — the Template's design with a [[Playbook]]'s words written
        // into it — and re-snapshotting would take the words straight back
        // out, which is a blank popup and a merchant who watched it happen.
        try {
            $normalized = $this->normalizeConfig($config, self::optionalString($config['template_id'] ?? null));
        } catch (InvalidSchedule $refused) {
            return self::refuseTheSchedule($refused);
        }

        if (!$this->vocabulary->hasTrigger($normalized['rules'] ?? [])) {
            return self::needsATrigger();
        }

        // No arm check on a create: `POST /optins` writes no `parent_id`, and
        // {@see OptinRepository::createVariant()} makes an arm by COPYING its
        // parent's config — so an arm is born comparable and only an edit can
        // break it.
        $refusal = $this->refuseADesignThatCapturesNothing($normalized, $goal)
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
        $choiceRefusal = $this->refuseMalformedChoices(is_array($config) ? ($config['template'] ?? null) : null);
        if ($choiceRefusal !== null) {
            return $choiceRefusal;
        }
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

        // An editor may prepare a snapshot before Save, then edit it. The
        // source assertion preserves that draft; normal vocabulary, goal,
        // conversion and destination checks below still apply to every value.
        // This request metadata is never stored in the Optin's config.
        $source = self::optionalString($request->get_param('template_source'));
        if ($source !== null && is_array($config) && $source === ($config['template_id'] ?? null)) {
            $pickedBefore = $source;
        }

        try {
            $normalized = is_array($config) ? $this->normalizeConfig($config, $pickedBefore) : null;
        } catch (InvalidSchedule $refused) {
            return self::refuseTheSchedule($refused);
        }

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

        // ====================================================================
        // THE DESIGN THIS OPTIN WILL HOLD, WHICH IS NOT ALWAYS THE ONE THAT
        // ARRIVED — AND THAT IS A HOLE THAT WAS OPEN.
        // ====================================================================
        // Both refusals were guarded on `$normalized !== null`, so
        // `PATCH {"goal": …}` carrying NO `config` wrote any settable Goal
        // onto any design and any binding with nothing asked at all. It was
        // unreachable from the admin, which is exactly ADR 0026's point about
        // the goal screen — *"a screen is not an enforcement mechanism"* — and
        // this route is scriptable by anyone holding `manage_options`.
        //
        // It matters more now than it did, because there IS a control that
        // changes a Goal (ADR 0059). So the pairing is asked against the
        // config this Optin will end up with: the one that arrived, or the one
        // it already has.
        $design = $normalized ?? ($stored === null ? [] : $stored->config);

        // Asked whenever either half of the pair is being written. A PATCH
        // carrying only a NAME is editing neither and is not asked — refusing
        // a rename because of a design somebody saved earlier would be
        // refusing an edit that cannot make anything worse.
        if ($held !== null && ($normalized !== null || $checked !== null)) {
            $refusal = $this->refuseADesignThatCapturesNothing($design, $held);

            if ($refusal !== null) {
                return $refusal;
            }
        }

        // The other two are about the DESIGN and are asked only where one
        // arrived. Both are already true of whatever is stored — nothing could
        // have written it otherwise — so asking them of the stored config
        // would only ever refuse an edit for a state the merchant is not
        // creating.
        if ($normalized !== null) {
            $refusal = $this->refuseAnArmMeteredDifferently($normalized, $id)
                ?? self::refuseADesignThatCannotConvert($normalized);

            if ($refusal !== null) {
                return $refusal;
            }
        }

        $optin = $this->optins->saveDraft(
            $id,
            self::optionalString($request->get_param('name')),
            $checked?->value,
            $normalized
        );

        if ($optin === null) {
            return self::notFound();
        }

        $this->recordTheFirstOverride($stored, $optin);

        return new WP_REST_Response($optin->toArray());
    }

    /**
     * ========================================================================
     * THE MILESTONE THAT READS THE GOAL CATALOGUE DIRECTLY (#94).
     * ========================================================================
     * The [[Goal]] and [[Playbook]] catalogue was derived by classifying 462
     * listings and 670 reviews down to five Goals. Nothing has challenged that
     * guess yet, and **what a merchant changes first — and in which Playbook —
     * is the sharpest available evidence that a Goal's defaults are wrong**.
     *
     * ========================================================================
     * THIS ROUTE, AND NOT `OptinRepository::saveDraft()`.
     * ========================================================================
     * The activation milestone deliberately sits inside
     * {@see \WConvert\Optin\OptinRepository::publish()} rather than in this
     * file, because that method IS the event and a stamp written here would be
     * one a WP-CLI command or a bulk action silently missed. **The mirror rule
     * would put this in `saveDraft()`, and it does not, for a reason that is
     * about the repository rather than about convenience:** working out which
     * suggestion was overridden means reading a [[Template]]'s words by
     * [[Slot Role]], so it needs {@see TemplateVocabulary} — a whole design
     * grammar handed to a class whose job is projections and columns, to serve
     * one date. `OptinRepositoryStaysStorageTest` holds that line from the
     * other side, and pins this route as the only writer of a draft, so a
     * second one cannot arrive quietly.
     *
     * **AFTER the save, and only on a save that happened.** An edit refused
     * for its schedule or its design is not an edit a merchant made, and
     * recording one would put a rejected act in a record that can only be
     * written once. That decision is genuinely this route's — the refusals
     * live here — which is the half of the job that stayed.
     *
     * The record itself is one day, one Playbook id and one of five words:
     * there is no Optin id and no user id, because neither is a fact about the
     * SITE (ADR 0017). {@see FirstEdit::between()} decides what changed and
     * {@see \WConvert\Milestone\MilestoneStore} holds the record-once rule.
     */
    private function recordTheFirstOverride(?Optin $before, Optin $after): void
    {
        if ($before === null) {
            return;
        }

        // The site's day, from the one place that reads the site's timezone —
        // so a milestone stamped by an edit and one derived from a beacon
        // agree about which day it was.
        $edit = FirstEdit::between($before, $after, $this->templates, StatDay::today());

        if ($edit !== null) {
            $this->milestones->recordFirstEdit($edit);
        }
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function publish(WP_REST_Request $request)
    {
        $id = (string) $request->get_param('id');
        $optin = $this->optins->find($id);

        if ($optin === null || $optin->isDeleted()) {
            return self::notFound();
        }

        if (!$optin->hasDesign()) {
            return new WP_Error(
                'wconvert_optin_needs_a_design',
                __('Choose a design before publishing. You can keep saving this Optin as a draft.', 'wconvert'),
                ['status' => 400]
            );
        }

        $issue = \WConvert\Template\TemplateForm::issue($optin->config['template'] ?? null);
        if ($issue !== null) {
            return new WP_Error('wconvert_optin_form_incomplete', $issue === 'choices'
                ? __('Add at least one choice to the interest field before publishing. You can keep saving this Optin as a draft.', 'wconvert')
                : __('Add an email or phone field before publishing this form. You can keep saving this Optin as a draft.', 'wconvert'), ['status' => 400]);
        }

        $published = $this->optins->publish($id);

        if ($published === null) {
            return self::notFound();
        }

        // A successful promotion is not necessarily showing on this install.
        // Return the confirmed state so the editor needs no second request to
        // distinguish a published snapshot from a suspended one.
        $suspended = Suspension::reasonsIn($this->publishedSet->all(), $this->degradation, $this->rules);

        return new WP_REST_Response($published->toArray() + ['suspended' => $suspended[$id] ?? null]);
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

    public function showSiteFrequency(): WP_REST_Response
    {
        return new WP_REST_Response($this->siteFrequency->authored());
    }

    /**
     * Write the site's allowance, and answer with what was stored.
     *
     * The body is handed to {@see SiteFrequency} whole rather than picked
     * apart here, and the answer is that class's own shape rather than one
     * assembled in this file. That is deliberate and is ADR 0047's amendment
     * applied a second time: `frequency` and `priority` once travelled through
     * this controller as unvalidated passthrough, every merchant Optin shipped
     * uncapped, and nobody noticed until the rules panel landed. The
     * arithmetic that decides what a valid allowance is — and, at this scope,
     * what an absent key means — lives in one place that is not HTTP.
     *
     * **`get_params()` rather than `get_json_params()`**, because only one
     * body shape is JSON. `get_json_params()` is null for a form-encoded POST,
     * and a null read as "an empty allowance" would answer 200 while quietly
     * turning the merchant's site-wide cap off. Reading everything WordPress
     * collected is safe here precisely because the value object picks the four
     * keys it knows: whatever else the request carried — `_locale`, a nonce —
     * is not an allowance and is not treated as one.
     */
    public function updateSiteFrequency(WP_REST_Request $request): WP_REST_Response
    {
        $this->siteFrequency->set($request->get_params());

        return new WP_REST_Response($this->siteFrequency->authored());
    }

    /** Refuse entered choices before normalization could silently discard them.
     * @param mixed $template
     */
    private function refuseMalformedChoices($template): ?WP_Error
    {
        $steps = is_array($template) && is_array($template['tree']['steps'] ?? null) ? $template['tree']['steps'] : [];
        $invalid = function (array $node) use (&$invalid): bool {
            if (($node['type'] ?? null) === 'field' && ($node['name'] ?? null) === 'interest' && array_key_exists('options', $node)) {
                $options = $node['options'];
                if (!is_array($options) || $options !== array_values($options)
                    || count($this->templates->choiceOptions($options)) !== count($options)) {
                    return true;
                }
            }
            foreach (TemplateTree::childrenOf($node) as $child) {
                if (is_array($child) && $invalid($child)) {
                    return true;
                }
            }
            return false;
        };
        foreach ($steps as $step) {
            if (is_array($step) && $invalid($step)) {
                return new WP_Error('wconvert_optin_choices_invalid',
                    __('Fix the interest choices before saving: each entered choice needs a label and a unique valid sent value. Your changes are still here.', 'wconvert'),
                    ['status' => 400]);
            }
        }
        return null;
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

        // **The placement, which reached the browser unvalidated until now.**
        // `display_type` is one of the four keys the published projection
        // ships, and it was the only one of them whose contents nothing
        // checked: an arbitrary string travelled from this request body into
        // every matching page, where `decide.ts` compares it against `inline`
        // and `mount.ts` against `popup` and neither can match it.
        //
        // Dropped rather than refused, because absent already MEANS `popup` on
        // both sides — so an unrecognised placement degrades to the one every
        // install has instead of producing an entry the renderer cannot place.
        // That is the same posture `rules` takes one branch up: an
        // unrecognised member of a closed set is a mistake, and dropping it at
        // the write is what keeps it out of a payload nothing can evaluate.
        if (isset($config['display_type'])) {
            $type = DisplayType::of($config['display_type']);

            if ($type === null) {
                unset($config['display_type']);
            } else {
                $config['display_type'] = $type->value;
            }
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

        // ====================================================================
        // THE SCHEDULE, AND THE REFUSAL IS THE NORMALISER'S RATHER THAN THIS
        // ROUTE'S.
        // ====================================================================
        // {@see Schedule::fromArray()} canonicalises what an
        // `<input type="datetime-local">` posts, drops anything that is not a
        // moment, and THROWS on an end at or before its start — so the rule
        // about what a valid window is lives in one pure place and this route
        // only turns the refusal into a 400.
        //
        // That split is ADR 0047's lesson applied before it costs anything:
        // `frequency` and `priority` were validated in a REST controller
        // nowhere, then in one, and the site-wide surface that reuses them is
        // not a REST controller. A schedule has the same second author coming
        // — the wall time is authored, and nothing about authoring one is
        // HTTP.
        //
        // Stored as the merchant's own LOCAL WALL TIME, never as an instant.
        // The projection resolves it against `wp_timezone()` on every rebuild
        // (ADR 0003), so a merchant who corrects their site timezone corrects
        // every schedule with it; freezing the instant here would leave them
        // all an hour out with nothing on any screen to say why.
        //
        // Both keys are UNSET where nothing was authored, for the reason the
        // allowance's is: the payload is inlined into every matching page
        // against a 2KB budget (ADR 0014).
        $schedule = Schedule::fromArray($config)->toArray();

        unset($config['starts_at'], $config['ends_at']);

        $config += $schedule;

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
     * The two things a schedule can be that are not a schedule.
     *
     * The WORDING is here and the RULE is not: {@see Schedule::fromArray()}
     * decides what a possible window is and says WHICH way it failed, and this
     * turns that decision into a status code and a sentence. A second author
     * reaches the same refusal, with the same distinction, without reaching
     * this file.
     *
     * Two sentences because they send a merchant to different places. Only the
     * backwards one is reachable from the builder — the two controls are
     * `<input type="datetime-local">` and cannot produce an unreadable value —
     * so the other is met through a scripted call, where the fact is what
     * matters and an instruction would be noise.
     */
    private static function refuseTheSchedule(InvalidSchedule $refused): WP_Error
    {
        return new WP_Error(
            'wconvert_optin_invalid_schedule',
            $refused->reason === InvalidSchedule::UNREADABLE
                ? __('An Optin’s start and end have to be a date and a time.', 'wconvert')
                : __('An Optin’s schedule has to end after it starts.', 'wconvert'),
            ['status' => 400]
        );
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
     * ========================================================================
     * WHAT A DESIGN CAPTURES IS WHAT THIS ASKS. IT ASKS NO ACT AT ALL.
     * ========================================================================
     * This was `refuseAMetricItCannotReport()`, and it enforced the pairing
     * *"one Optin has exactly one converting act, and its [[Goal]] decides
     * which"* — refusing `{goal: 'promote_offer', template_id: 'centred-card'}`
     * outright. **The Goal no longer decides** (ADR 0059): a registered design
     * offers exactly one act, {@see TemplateLibrary::refuse()} is what makes
     * that true, and the loader has always derived the act from the design it
     * was handed. A Goal that declared one as well was a second source, and
     * every act-shaped refusal in the product existed only because the two
     * could disagree.
     *
     * So the pairing is gone and the pairing's one REAL consequence stays,
     * re-keyed onto the thing it was always about — what the design captures:
     *
     * 1. **A Goal counting deliveries needs a capturing design.**
     *    `lead_magnet_delivered` is written when a push to the lead-magnet
     *    [[Destination]] succeeds, and there is nothing to push unless the
     *    visitor gave an address. Under a design with no `field` on it the
     *    headline reads **zero forever** — ADR 0020's failure that looks
     *    broken while being right.
     * 2. **A design that captures nothing holds no [[Destination]] ids.**
     *    ADR 0025 argued this from the click metric and it was never about the
     *    metric: a bound Destination on an Optin with no form is configuration
     *    that can never fire, whatever counts it. Refused rather than
     *    stripped, because stripping writes a decision the merchant did not
     *    make and leaves them looking for a binding that is silently gone.
     *
     * **The Goal is nullable, and rule 2 is why.** *"It captures nothing so it
     * has nothing to send"* is true under every Goal, including one this
     * install can no longer resolve — so making the whole method depend on a
     * Goal would let rule 2 lapse on precisely the rows ADR 0026 keeps
     * working. That is the same argument
     * {@see self::refuseADesignThatCannotConvert()} makes one method down.
     *
     * **The capture is read with `TemplateFacets`' own walk**, which is what
     * the gallery's `captures` chips are derived from at registration — so the
     * card that marks a design refused and the save that refuses it cannot
     * disagree about what a design asks for.
     *
     * **A design offering nothing is not refused here.** A draft mid-creation
     * has no template yet, and refusing one would block the save that is about
     * to add it.
     *
     * @param array<string, mixed> $config Already normalised.
     */
    private function refuseADesignThatCapturesNothing(array $config, ?Goal $goal): ?WP_Error
    {
        $tree = $config['template']['tree'] ?? null;

        if (!is_array($tree) || !is_array($tree['steps'] ?? null) || $tree['steps'] === []) {
            return null;
        }

        if (TemplateFacets::of($tree, $this->templates->fields())['captures'] !== []) {
            return null;
        }

        if ($goal !== null && $goal->needsACapture()) {
            return new WP_Error(
                'wconvert_optin_captures_nothing',
                sprintf(
                    /* translators: %s: the name of the Goal the Optin is filed under. */
                    __(
                        // **It names a door that is on the screen**, which is
                        // what ADR 0042 rule 4 asks and what the sentence this
                        // replaces could not do: the Design tab is one click
                        // away and the gallery marks the capturing designs
                        // before the click. The old wording said "or change
                        // the Goal" against no such control; there is one now,
                        // and this still points at the design, because the
                        // Goal is what the merchant meant.
                        '“%s” counts deliveries, and this design captures nothing to deliver to. Pick a design with a field on it from the Design tab.',
                        'wconvert'
                    ),
                    $goal->label()
                ),
                ['status' => 400]
            );
        }

        if (($config[OptinBinding::KEY] ?? []) !== []) {
            return new WP_Error(
                'wconvert_optin_captures_nothing',
                __(
                    'This design captures nothing, so it has no leads to send anywhere. Remove its destinations first.',
                    'wconvert'
                ),
                ['status' => 400]
            );
        }

        return null;
    }

    /**
     * ========================================================================
     * TWO ARMS OF ONE TEST CONVERT THE SAME WAY, OR THE TEST COMPARES NOTHING.
     * ========================================================================
     * **This is the guarantee the shared [[Goal]] used to smuggle in.**
     * {@see OptinRepository::createVariant()} copies its parent's Goal and says
     * why: *"two arms serving different Goals would be metered by different
     * acts, and the rate under one would not be the rate under the other"*.
     * That held because a Goal declared an act. It no longer does (ADR 0059),
     * and an arm is a whole Optin with its own `config` (ADR 0045) — so a
     * merchant could give arm A a form and arm B a click CTA, and the test
     * would put a ~3% submission rate beside a ~25% click rate and call one of
     * them the winner.
     *
     * The A/B literature names this as *the* invalid-comparison failure:
     * define the conversion event clearly, so you are comparing like with
     * like. It is the one thing about an arm that is genuinely not a fact
     * about that arm alone, which is why it is stated here rather than left to
     * the copy that made it.
     *
     * **Asked of the siblings' own configs**, never of a flag: the act a
     * sibling converts on is a fact about the design it holds, and a second
     * copy of it anywhere would be the duplicate declaration this whole ticket
     * deleted. It reads them through {@see self::actOfTheOtherArms()}, which is
     * the same method `show()` hands to the picker — so a card the gallery
     * leaves offerable is one this cannot then refuse.
     *
     * **A design offering nothing is not refused here either.** It is refused
     * one method down, under its own sentence — telling a merchant their
     * button-less design is *"not comparable with the other arm"* would name
     * the smaller of two problems.
     *
     * @param array<string, mixed> $config Already normalised.
     */
    private function refuseAnArmMeteredDifferently(array $config, string $id): ?WP_Error
    {
        $offered = ConvertingAct::offeredIn($config['template']['tree'] ?? null);
        $siblings = $this->actOfTheOtherArms($id);

        if (count($offered) !== 1 || $siblings === null || $offered[0] === $siblings) {
            return null;
        }

        return new WP_Error(
            'wconvert_optin_arms_are_not_comparable',
            $offered[0] === ConvertingAct::Click
                ? __(
                    'This design converts on a click and the other arm of this test converts on a form submission, so the two rates would not be comparable.',
                    'wconvert'
                )
                : __(
                    'This design converts on a form submission and the other arm of this test converts on a click, so the two rates would not be comparable.',
                    'wconvert'
                ),
            ['status' => 400]
        );
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
     * {@see self::refuseADesignThatCapturesNothing()} exists two methods up.
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
