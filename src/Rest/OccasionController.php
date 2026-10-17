<?php

namespace WConvert\Rest;

use WConvert\Discovery\OccasionStore;
use WConvert\Optin\DisplayType;
use WConvert\Optin\NextYear;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\Schedule;
use WConvert\Rules\DisplayPlan;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * What a merchant does to a whole occasion: copy it to next year (#279), and
 * carry it to another site as one document (#280, ADR 0153).
 *
 * ============================================================================
 * EVERY CAMPAIGN IS CREATED THROUGH `POST /optins`, AND IS A DRAFT.
 * ============================================================================
 * Each campaign is created by `rest_do_request()` against the route the editor
 * uses, so the args schema, the vocabulary, the Goal and every refusal in
 * {@see OptinController::store()} apply to a copied or imported campaign
 * exactly as to a typed one. That route writes drafts only, so nothing here
 * can publish, and an original is never written (ADR 0149 §6).
 *
 * The occasion is written first, through {@see OccasionStore}, because the
 * campaigns link to it and the create refuses a link to an occasion that does
 * not exist.
 */
final class OccasionController implements RestController
{
    private const ID = '(?P<id>[a-z0-9-]{1,64})';

    public const FORMAT = 'wconvert-occasion';

    /** The display types a free install has designs for (PackValidator's rule). */
    private const FREE_DISPLAY_TYPES = ['popup', 'inline'];

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly OccasionStore $occasions,
        private readonly TemplateLibrary $library,
        private readonly TemplateVocabulary $vocabulary,
        private readonly ProPresence $pro,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/occasions', [
            'methods' => 'GET', 'callback' => fn (): WP_REST_Response => new WP_REST_Response($this->occasions->read()),
            'permission_callback' => [Routes::class, 'canManage'],
        ]);
        register_rest_route(Routes::NAMESPACE, '/occasions/' . self::ID . '/copy', [
            'methods' => 'POST', 'callback' => [$this, 'copy'], 'permission_callback' => [Routes::class, 'canManage'],
        ]);
        register_rest_route(Routes::NAMESPACE, '/occasions/' . self::ID . '/export', [
            'methods' => 'GET', 'callback' => [$this, 'export'], 'permission_callback' => [Routes::class, 'canManage'],
        ]);
        register_rest_route(Routes::NAMESPACE, '/occasions/import', [
            'methods' => 'POST', 'callback' => [$this, 'import'], 'permission_callback' => [Routes::class, 'canManage'],
            'args' => ['document' => ['required' => true, 'type' => 'object']],
        ]);
    }

    /** The occasion a year later, with a draft of each of its campaigns. */
    public function copy(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $source = $this->occasions->find((string) $request->get_param('id'));
        if ($source === null) return self::notFound();
        $year = (int) substr($source['start'], 0, 4);

        $occasion = [
            'id' => (string) substr(NextYear::name(substr($source['id'], 0, 59), $year, '-'), 0, 64),
            'name' => NextYear::name(mb_substr($source['name'], 0, 115), $year),
            'start' => (string) NextYear::day($source['start']),
            'end' => (string) NextYear::day($source['end']),
        ];
        $occasion = $this->add($occasion);
        if ($occasion instanceof WP_Error) return $occasion;

        $created = []; $failed = [];
        foreach ($this->campaignsOf($source['id']) as $campaign) {
            $config = $campaign->config;
            foreach (['starts_at', 'ends_at'] as $key) {
                $shifted = NextYear::wall(is_string($config[$key] ?? null) ? $config[$key] : null);
                if ($shifted === null) unset($config[$key]);
                else $config[$key] = $shifted;
            }
            // As Duplicate does: a label names one campaign in someone's reports.
            if (is_array($config['analytics'] ?? null)) $config['analytics']['label'] = '';
            $config['occasion'] = $occasion['id'];
            $name = NextYear::name($campaign->name, $year, null);
            $result = self::createDraft($name, $campaign->goal, $config);
            if (is_string($result)) $failed[] = ['name' => $name, 'message' => $result];
            else $created[] = $result;
        }

        return new WP_REST_Response(['occasion' => $occasion, 'created' => $created, 'failed' => $failed], 201);
    }

    /** One occasion and its campaigns as the document ADR 0153 describes. */
    public function export(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $occasion = $this->occasions->find((string) $request->get_param('id'));
        if ($occasion === null) return self::notFound();

        $campaigns = [];
        foreach ($this->campaignsOf($occasion['id']) as $campaign) {
            $config = $campaign->config;
            $tree = $config['template']['tree'] ?? null;
            $design = is_string($config['template_id'] ?? null) && $this->library->find($config['template_id']) !== null ? $config['template_id'] : null;
            $entry = [
                'name' => $campaign->name,
                'goal' => $campaign->goal,
                'display_type' => (DisplayType::of($config['display_type'] ?? null) ?? DisplayType::Popup)->value,
                'design' => $design,
                'copy' => is_array($tree) ? SlotRoles::copyFrom($tree, $this->vocabulary) : [],
                'link' => self::linkIn($config),
            ];
            // A design the library does not hold cannot be named, so it travels whole.
            if ($design === null && is_array($config['template'] ?? null)) $entry['template'] = $config['template'];
            foreach (['targeting', 'frequency', 'display_rules'] as $key) {
                if (isset($config[$key])) $entry[$key] = $config[$key];
            }
            $entry['starts_at'] = $config['starts_at'] ?? null;
            $entry['ends_at'] = $config['ends_at'] ?? null;
            $campaigns[] = $entry;
        }

        return new WP_REST_Response(['format' => self::FORMAT, 'schema' => 1, 'occasion' => $occasion, 'campaigns' => $campaigns]);
    }

    /**
     * Create the occasion and a draft of each campaign the document carries.
     *
     * The whole document is checked before anything is written: a document
     * with a mistake in its fourth campaign leaves no occasion behind with
     * three of them in it. What CAN refuse one campaign alone is what this
     * site cannot hold — a Pro display type on free, a design this library
     * does not have — and those campaigns are named in the reply.
     */
    public function import(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $document = $request->get_param('document');
        $errors = is_array($document) ? self::errorsIn($document) : ['document' => __('This is not an occasion file.', 'wconvert')];
        if ($errors !== []) {
            return new WP_Error('wconvert_occasion_invalid', __('This file cannot be imported. Nothing was changed.', 'wconvert'), ['status' => 422, 'errors' => $errors]);
        }
        /** @var array{occasion: array<string, string>, campaigns: list<array<string, mixed>>} $document */
        $occasion = $this->add(array_intersect_key($document['occasion'], array_flip(['id', 'name', 'start', 'end'])));
        if ($occasion instanceof WP_Error) return $occasion;

        $created = []; $refused = [];
        foreach ($document['campaigns'] as $campaign) {
            $config = $this->configFor($campaign, $occasion['id']);
            $result = is_string($config) ? $config : self::createDraft($campaign['name'], $campaign['goal'], $config);
            if (is_string($result)) $refused[] = ['name' => $campaign['name'], 'reason' => $result];
            else $created[] = $result;
        }
        // Nothing came across, so nothing stays: an empty occasion is not
        // what the file described. Its id retires, and nothing links to it.
        if ($created === [] && $refused !== []) {
            $id = $occasion['id'];
            $this->occasions->write(static fn (array $items): array => array_values(array_filter($items, static fn (array $item): bool => $item['id'] !== $id)));
            return new WP_Error('wconvert_occasion_nothing_imported', __('No campaign in this file can be imported here. Nothing was changed.', 'wconvert'), ['status' => 422, 'refused' => $refused]);
        }

        return new WP_REST_Response(['occasion' => $occasion, 'created' => $created, 'refused' => $refused], 201);
    }

    /**
     * Where a document is wrong, keyed by the path to the value.
     *
     * @param array<string, mixed> $document
     * @return array<string, string>
     */
    public static function errorsIn(array $document): array
    {
        $errors = [];
        if (($document['format'] ?? null) !== self::FORMAT || ($document['schema'] ?? null) !== 1) {
            return ['format' => __('This is not an occasion file this version can read.', 'wconvert')];
        }
        try {
            \WConvert\Discovery\PickerDocuments::validateOccasions([$document['occasion'] ?? null]);
        } catch (\InvalidArgumentException $invalid) {
            $errors['occasion'] = $invalid->getMessage();
        }
        $campaigns = $document['campaigns'] ?? null;
        if (!is_array($campaigns) || !array_is_list($campaigns) || count($campaigns) > 50) {
            return $errors + ['campaigns' => __('List at most 50 campaigns.', 'wconvert')];
        }
        foreach ($campaigns as $index => $campaign) {
            $at = 'campaigns.' . $index;
            if (!is_array($campaign)) { $errors[$at] = __('Invalid campaign.', 'wconvert'); continue; }
            $name = $campaign['name'] ?? null;
            if (!is_string($name) || trim($name) === '' || mb_strlen($name) > 190) $errors[$at . '.name'] = __('Give each campaign a name under 190 characters.', 'wconvert');
            if (\WConvert\Goal\Goal::tryFrom(is_string($campaign['goal'] ?? null) ? $campaign['goal'] : '') === null) $errors[$at . '.goal'] = __('Name a goal WConvert has.', 'wconvert');
            if (DisplayType::of($campaign['display_type'] ?? null) === null) $errors[$at . '.display_type'] = __('Use a known display type.', 'wconvert');
            $design = $campaign['design'] ?? null;
            if ($design !== null && (!is_string($design) || !preg_match('/^[a-z0-9-]{1,100}$/D', $design))) $errors[$at . '.design'] = __('Name a design by its id.', 'wconvert');
            if ($design === null && !is_array($campaign['template'] ?? null)) $errors[$at . '.design'] = __('Name a design, or include its template.', 'wconvert');
            if (isset($campaign['copy']) && (!is_array($campaign['copy']) || ($campaign['copy'] !== [] && array_is_list($campaign['copy']))
                || array_filter($campaign['copy'], static fn ($words) => !is_string($words) && !is_array($words)) !== [])) $errors[$at . '.copy'] = __('Copy is a map of words by role.', 'wconvert');
            if (isset($campaign['link']) && (!is_string($campaign['link']) || strlen($campaign['link']) > 2000)) $errors[$at . '.link'] = __('Use a link of up to 2000 characters.', 'wconvert');
            foreach (['targeting', 'frequency', 'display_rules'] as $key) {
                if (isset($campaign[$key]) && !is_array($campaign[$key])) $errors[$at . '.' . $key] = __('Invalid campaign settings.', 'wconvert');
            }
            foreach (['starts_at', 'ends_at'] as $key) {
                $value = $campaign[$key] ?? null;
                if ($value !== null && (!is_string($value) || !self::isWallTime($value))) $errors[$at . '.' . $key] = __('Use a date and time like 2026-11-20 00:00.', 'wconvert');
            }
        }
        return $errors;
    }

    /**
     * The config a document's campaign becomes, or why this site refuses it.
     *
     * @param array<string, mixed> $campaign Already checked by {@see self::errorsIn()}.
     * @return array<string, mixed>|string
     */
    private function configFor(array $campaign, string $occasion): array|string
    {
        $type = (string) $campaign['display_type'];
        if ($this->pro->installedTier() === Tier::Free && !in_array($type, self::FREE_DISPLAY_TYPES, true)) {
            return __('This display type needs WConvert Pro.', 'wconvert');
        }
        $config = ['display_type' => $type, 'occasion' => $occasion];
        $design = $campaign['design'] ?? null;
        if (is_string($design)) {
            $entry = $this->library->find($design);
            if ($entry === null) return __('This site does not have that design.', 'wconvert');
            if (($entry['display_type'] ?? 'popup') !== $type) return __('That design is for a different display type.', 'wconvert');
            $config = $this->library->snapshotInto($config + ['template_id' => $design]);
            $config['template']['tree'] = SlotRoles::bind($config['template']['tree'], $campaign['copy'] ?? [], $this->vocabulary);
        } else {
            $config['template'] = $campaign['template'];
        }
        if (is_string($campaign['link'] ?? null) && $campaign['link'] !== '') {
            $config = TemplateTree::rewrittenIn($config, static function (array $node) use ($campaign): array {
                if (($node['type'] ?? null) === 'button' && ($node['action'] ?? null) === 'link') $node['href'] = $campaign['link'];
                return $node;
            });
        }
        foreach (['targeting', 'frequency', 'starts_at', 'ends_at'] as $key) {
            if (isset($campaign[$key])) $config[$key] = $campaign[$key];
        }
        // A document that names no display plan shows as a fresh setup does.
        $config['display_rules'] = $campaign['display_rules'] ?? DisplayPlan::immediate();
        return $config;
    }

    /**
     * Add an occasion, renaming its id until it is free — of live occasions
     * and of deleted ones, whose campaigns still carry it.
     *
     * @param array<string, string> $occasion
     * @return array<string, string>|WP_Error
     */
    private function add(array $occasion): array|WP_Error
    {
        $taken = $this->occasions->taken();
        $saved = $this->occasions->write(static function (array $items) use (&$occasion, $taken): array {
            $taken = [...$taken, ...array_column($items, 'id')];
            $base = $occasion['id'];
            for ($n = 2; in_array($occasion['id'], $taken, true); $n++) {
                $suffix = '-' . $n;
                $occasion['id'] = substr($base, 0, 64 - strlen($suffix)) . $suffix;
            }
            return [...$items, $occasion];
        });
        return $saved instanceof WP_Error ? $saved : $occasion;
    }

    /**
     * The campaigns an occasion holds: parents only, as Duplicate copies no arm.
     *
     * @return list<Optin>
     */
    private function campaignsOf(string $occasion): array
    {
        $found = [];
        foreach ($this->optins->summaries() as $row) {
            if (($row['occasion'] ?? null) !== $occasion) continue;
            $optin = $this->optins->find((string) $row['id']);
            if ($optin !== null && $optin->deletedAt === null && $optin->parentId === null) $found[] = $optin;
        }
        return array_reverse($found);
    }

    /**
     * Create one draft through the editor's own route.
     *
     * @param array<string, mixed> $config
     * @return array{id: string, name: string}|string The draft, or why it was refused.
     */
    private static function createDraft(string $name, string $goal, array $config): array|string
    {
        $request = new WP_REST_Request('POST', '/' . Routes::NAMESPACE . '/optins');
        $request->set_param('name', $name);
        $request->set_param('goal', $goal);
        $request->set_param('config', $config);
        $response = rest_do_request($request);
        $data = $response->get_data();
        if ($response->get_status() >= 400 || !is_array($data) || !is_string($data['id'] ?? null)) {
            return is_array($data) && is_string($data['message'] ?? null) ? $data['message'] : __('This campaign could not be created.', 'wconvert');
        }
        return ['id' => $data['id'], 'name' => (string) ($data['name'] ?? $name)];
    }

    /** @param array<string, mixed> $config */
    private static function linkIn(array $config): ?string
    {
        $link = null;
        TemplateTree::rewrittenIn($config, static function (array $node) use (&$link): array {
            if ($link === null && ($node['type'] ?? null) === 'button' && ($node['action'] ?? null) === 'link' && is_string($node['href'] ?? null) && $node['href'] !== '') $link = $node['href'];
            return $node;
        });
        return $link;
    }

    private static function isWallTime(string $value): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!' . Schedule::FORMAT, $value);
        return $parsed !== false && $parsed->format(Schedule::FORMAT) === $value;
    }

    private static function notFound(): WP_Error
    {
        return new WP_Error('wconvert_occasion_not_found', __('No such occasion.', 'wconvert'), ['status' => 404]);
    }
}
