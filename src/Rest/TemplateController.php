<?php

namespace WConvert\Rest;

use WConvert\Goal\Goal;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;
use WConvert\Template\TemplateLabels;
use WConvert\Template\PictureTransfer;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * REST for the Template gallery: read-only, because a Template is shipped
 * rather than authored here.
 *
 * ============================================================================
 * AN INDEX AND THE TREES, AND THE SPLIT IS THE WHOLE TICKET.
 * ============================================================================
 * This route returned `array_values($this->templates->all())` — **every tree,
 * every request**. At three entries that is free. At forty, across four Display
 * Types, with a free/Pro split, it is the picker's whole cost paid before the
 * merchant has read a single card, and paid again on every builder load.
 *
 * So the library is *indexed*: {@see self::index()} answers what a card needs to
 * be drawn, filtered and counted — id, name, Display Type, tier, availability,
 * facets — and carries **no `tree` and no `tokens`**. {@see self::trees()}
 * answers for the handful of cards actually near the viewport, batched and
 * capped. `Preview.tsx` mounts against an `IntersectionObserver` for the same
 * reason from the other end (ADR 0043).
 *
 * **The facets are the server's**, computed once at registration
 * ({@see \WConvert\Template\TemplateFacets}). The client has `convertingActOf`
 * and could derive them — but this route deliberately withholds trees, so it
 * would have nothing to read.
 *
 * ============================================================================
 * THREE PLACES MOVE TOGETHER OR A NEW FIELD VANISHES IN SILENCE.
 * ============================================================================
 * {@see TemplateLibrary::read()}'s whitelist, `templates/api.ts`'s
 * `TemplateIndexEntry`, and `builder/entry.ts`'s `exportEntry()`. A field added
 * to one and not the others is dropped on the way through with nothing said,
 * which is exactly how a library entry acquires a key nothing reads.
 *
 * @since 0.1.0
 */
final class TemplateController implements RestController
{
    /**
     * How many trees one request may ask for.
     *
     * A ceiling on the response rather than on the picker: the grid decides
     * what is near the viewport and asks for that, and this is what stops a
     * hand-written URL asking for the whole library back through the route
     * built to avoid sending it. Comfortably above a full screen of cards at
     * the widest breakpoint the builder caps at (ADR 0038).
     */
    private const MOST_TREES = 24;

    public function __construct(
        private readonly TemplateLibrary $templates,
        private readonly TemplateVocabulary $vocabulary,
        private readonly ProPresence $pro,
        private readonly ?PrivacyGuidance $privacyGuidance = null,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/templates/snapshot', [
            'methods' => 'POST',
            'callback' => [$this, 'snapshot'],
            'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'id' => ['type' => 'string', 'required' => true],
                    'source' => ['type' => 'string'],
                    'goal' => ['type' => 'string'],
                    'template' => ['type' => 'object', 'default' => []],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/templates', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/templates/trees', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'trees'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'ids' => [
                        'type' => 'string',
                        'required' => true,
                    ],
                ],
            ],
        ]);
    }

    /**
     * The library as an INDEX, the vocabulary's words, and the facet
     * vocabulary the chip strip enumerates.
     *
     * Three keys rather than three routes, because one screen reads all three
     * together and none of them is large. The WORDS are here at all for the
     * reason ADR 0013 gives about [[Playbook]]s: `wp i18n make-pot` cannot see
     * a string inside JSON, so a value that used to be a key two programs
     * agreed on has to acquire a translatable name the moment it becomes a chip
     * ({@see TemplateLabels}).
     *
     * **Locked designs interleave with the rest**, sorted into one list by id,
     * because a merchant comparing designs is comparing designs — a premium one
     * pushed to the bottom is an advertisement in the shape of a gallery. What
     * marks it is its `availability`, which the surface renders through the
     * doctrine it already has (`availability.ts`, ADR 0026).
     */
    public function index(): WP_REST_Response
    {
        $entries = [];

        foreach ($this->templates->all() as $entry) {
            if (($entry['catalog_current'] ?? true) === false) continue;
            $entries[] = $this->indexEntry($entry, $this->availabilityOf((string) $entry['tier']));
        }

        foreach ($this->templates->locked() as $entry) {
            // **`locked` by construction, not by tier arithmetic.** A stub is a
            // design this install did not get — that is what having no tree
            // MEANS ({@see \WConvert\Template\LockedTemplates}) — so it is
            // absent and buyable from us, whatever the tier flag beside it
            // says. Reading the flag instead would resolve a Pro-but-unshipped
            // design to `ready` and draw a card with nothing behind it.
            $entries[] = $this->indexEntry($entry, Availability::Locked);
        }

        usort($entries, static fn (array $a, array $b): int => strcmp((string) $a['id'], (string) $b['id']));

        return new WP_REST_Response([
            'templates' => $entries,
            'labels' => TemplateLabels::all(),
            'facets' => $this->vocabulary->facets(),
        ]);
    }

    /**
     * The designs themselves, for the cards on screen.
     *
     * **Only registered entries.** A locked design has no tree by construction,
     * so asking for one is not an error to report — it is simply absent from
     * the answer, and the card that asked keeps its skeleton and then its
     * *"See this design"* link. An id this install never shipped behaves
     * identically, which is the same stance {@see TemplateLibrary::snapshotInto()}
     * takes: an id naming nothing here is not a broken request.
     */
    public function trees(WP_REST_Request $request): WP_REST_Response
    {
        $asked = array_slice($this->idsIn($request), 0, self::MOST_TREES);
        $trees = [];

        foreach ($asked as $id) {
            $entry = $this->templates->find($id);

            if ($entry === null) {
                continue;
            }

            $trees[] = [
                'id' => $entry['id'],
                'tree' => $entry['tree'],
                'tokens' => $entry['tokens'],
            ];
        }

        return new WP_REST_Response(['templates' => $trees]);
    }

    /** Prepare a draft with the existing copy-carrying rules; write nothing. */
    public function snapshot(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = (string) $request->get_param('id');
        $entry = $this->templates->find($id);

        if ($entry === null || $this->availabilityOf((string) $entry['tier']) !== Availability::Ready) {
            return new WP_Error('wconvert_template_unavailable', __('This template is not available.', 'wconvert'), ['status' => 404]);
        }

        $source = $request->get_param('source');
        $config = $this->templates->snapshotInto([
            'template_id' => $id,
            'template' => $this->vocabulary->normalize($request->get_param('template')),
        ], is_string($source) ? $source : null);

        $goal = Goal::tryFrom((string) $request->get_param('goal'));
        if ($goal !== null && $this->privacyGuidance !== null) {
            $config['template']['tree'] = $this->privacyGuidance->treeFor(
                $config['template']['tree'] ?? [],
                $goal
            );
        }

        $transfer = PictureTransfer::prepare(
            $this->vocabulary->normalize($request->get_param('template')),
            is_string($source) ? $this->templates->find($source) : null,
            ['tree' => $entry['tree'], 'tokens' => $entry['tokens']]
        );
        return new WP_REST_Response($config['template'] + ['transfer' => [
            'unplaced' => $transfer['unplaced'], 'unverified' => $transfer['unverified'],
        ]]);
    }

    /**
     * The ids asked for, deduplicated, in the order they arrived.
     *
     * A comma-separated string rather than a repeated `ids[]` param, because
     * the client builds it from a Set and this is the shape `apiFetch` puts on
     * a URL without a serializer.
     *
     * @return list<string>
     */
    private function idsIn(WP_REST_Request $request): array
    {
        $raw = $request->get_param('ids');

        if (!is_string($raw)) {
            return [];
        }

        return array_values(array_unique(array_filter(
            array_map('trim', explode(',', $raw)),
            static fn (string $id): bool => $id !== ''
        )));
    }

    /**
     * One card's worth of an entry — everything but the design itself.
     *
     * `preview_url` travels only where there is one, which is only on a locked
     * card: it is where *"See this design"* goes, and it is the whole substitute
     * for a preview a free install cannot render. A `ready` card renders the
     * real design instead, which is what ADR 0010 means by there being no
     * thumbnails anywhere in this flow.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    private function indexEntry(array $entry, Availability $availability): array
    {
        $card = [
            'id' => $entry['id'],
            'design_key' => $entry['design_key'] ?? 'registered:' . $entry['id'],
            'name' => $entry['name'],
            'display_type' => $entry['display_type'],
            'tier' => $entry['tier'],
            'availability' => $availability->value,
            'facets' => $entry['facets'],
        ];

        if (is_string($entry['preview_url'] ?? null)) {
            $card['preview_url'] = $entry['preview_url'];
        }

        return $card;
    }

    /**
     * One registered design's Availability on this install.
     *
     * **`ready` or `locked`, never `unavailable`.** No site capability makes a
     * *design* absent — there is no WooCommerce a `split` layout needs — so the
     * first argument is always true and the third state does not arise. Said
     * through {@see Availability::of()} rather than by returning one of two
     * cases directly, so the precedence stays in the one place that owns it and
     * a future dependency would land here rather than in a second rule
     * (ADR 0026).
     */
    private function availabilityOf(string $tier): Availability
    {
        return Availability::of(true, (Tier::tryFrom($tier) ?? Tier::Free)->isSuppliedBy($this->pro));
    }
}
