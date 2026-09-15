<?php

namespace WConvert\Rest;

use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadQuery;
use InvalidArgumentException;
use WP_Error;
use WConvert\Retention\RetentionPeriod;
use WConvert\Support\Ulid;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the [[Lead]] log: read it, group it, and set how long it is kept.
 *
 * **Read-only over Leads, with no exception.** There is no create route, no
 * update route and no delete route, and that is not an oversight to fill in
 * later: a Lead has exactly one origin — a visitor submitting a form, in one
 * request, on a page WConvert served (ADR 0031) — and no lifecycle to edit
 * (ADR 0002). Removal happens through WordPress's own personal-data eraser
 * and through retention pruning, both of which are the site's decisions rather
 * than a row's.
 *
 * **One route serves both views**, because grouping is a presentation toggle
 * and not a different resource. A second route would be a second endpoint
 * reporting a second number, and the number a `/leads/people` would be asked
 * for next is the one ADR 0021 says this system cannot honestly produce.
 *
 * @since 0.1.0
 */
final class LeadController implements RestController
{
    private const DEFAULT_PER_PAGE = 50;

    public function __construct(
        private readonly LeadLog $log,
        private readonly RetentionPeriod $retention,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/leads', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    // A ULID or nothing. An `optin_id` that is not one is a
                    // filter that would silently match no rows, which reads on
                    // screen as an empty log rather than as a bad request.
                    'optin_id' => [
                        'type' => 'string',
                        'pattern' => '^' . Ulid::PATTERN . '$',
                    ],
                    // The grouping toggle. It changes what a ROW is and
                    // nothing else — the response's `submissions` is the same
                    // number either way (ADR 0021).
                    'grouped' => ['type' => 'boolean', 'default' => false],
                    'lead_id' => ['type' => 'string', 'pattern' => '^' . Ulid::PATTERN . '$'],
                    'identifier' => ['type' => 'string', 'maxLength' => 254],
                    'search' => ['type' => 'string', 'maxLength' => 200],
                    'purpose' => ['type' => 'string', 'enum' => ['subscribers', 'enquiries']],
                    'order' => ['type' => 'string', 'enum' => ['newest', 'oldest']],
                    'include_counts' => ['type' => 'boolean', 'default' => false],
                    'group_identifier' => ['type' => 'string', 'maxLength' => 254],
                    'from' => ['type' => 'string', 'maxLength' => 10],
                    'to' => ['type' => 'string', 'maxLength' => 10],
                    'cursor' => ['type' => 'string', 'maxLength' => 128],
                    'snapshot' => ['type' => 'string', 'pattern' => '^' . Ulid::PATTERN . '$'],
                    'per_page' => [
                        'type' => 'integer',
                        'default' => self::DEFAULT_PER_PAGE,
                        'minimum' => 1,
                        'maximum' => LeadLog::MAX_ROWS,
                    ],
                ],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/leads/retention', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'showRetention'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'updateRetention'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    // Nullable on purpose: null is keep-forever, which is what
                    // clearing the field means and what WConvert ships as
                    // (ADR 0018).
                    'days' => ['type' => ['integer', 'null']],
                ],
            ],
        ]);
    }

    public function index(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        try {
            $query = LeadQuery::fromInput($request->get_params());
        } catch (InvalidArgumentException $invalid) {
            return new WP_Error('wconvert_invalid_lead_query', $invalid->getMessage(), ['status' => 400]);
        }

        $payload = $this->log->read(
            $query->optinId,
            (bool) $request->get_param('grouped'),
            (int) ($request->get_param('per_page') ?? self::DEFAULT_PER_PAGE),
            $query
        );
        if ($request->get_param('include_counts')) $payload['purpose_counts'] = $this->log->counts($query, $payload['submissions']);
        return new WP_REST_Response($payload);
    }

    public function showRetention(): WP_REST_Response
    {
        return new WP_REST_Response($this->retentionState());
    }

    public function updateRetention(WP_REST_Request $request): WP_REST_Response
    {
        $days = $request->get_param('days');

        $this->retention->set($days === null ? null : (int) $days);

        return new WP_REST_Response($this->retentionState());
    }

    /**
     * @return array{days: int|null, max_days: int}
     */
    private function retentionState(): array
    {
        return ['days' => $this->retention->days(), 'max_days' => RetentionPeriod::MAX_DAYS];
    }
}
