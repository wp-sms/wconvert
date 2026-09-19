<?php

namespace WConvert\Rest;

use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadQuery;
use WConvert\Privacy\LeadErasure;
use InvalidArgumentException;
use WP_Error;
use WConvert\Retention\RetentionPeriod;
use WConvert\Support\Ulid;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the [[Lead]] log: read it, group it, erase an exact identifier,
 * and set how long it is kept.
 *
 * There is no create or update route: a Lead has exactly one origin and no
 * lifecycle (ADR 0002, ADR 0031). The one destructive route is deliberately
 * identifier-wide and exists for a verified privacy request. It deletes rows;
 * it does not edit one Lead or create a Contact/person resource (ADR 0018).
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
        private readonly LeadErasure $erasure,
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

        register_rest_route(Routes::NAMESPACE, '/leads/identifier', [
            [
                'methods' => 'DELETE',
                'callback' => [$this, 'eraseIdentifier'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'identifier' => ['type' => 'string', 'required' => true, 'maxLength' => 254],
                    'confirmed_identifier' => ['type' => 'string', 'required' => true, 'maxLength' => 254],
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

    public function eraseIdentifier(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $identifier = (string) $request->get_param('identifier');
        $confirmed = (string) $request->get_param('confirmed_identifier');
        $canonical = LeadErasure::canonical($identifier);
        $confirmation = LeadErasure::canonical($confirmed);

        // Never let a missing/mismatched confirmation fall through to a
        // broader action. Both values are canonicalised before anything is
        // deleted, so spelling differences are harmless but a different
        // person cannot be confirmed accidentally.
        if ($canonical === null || $confirmation === null || $canonical !== $confirmation) {
            return new WP_Error(
                'wconvert_invalid_erasure_identifier',
                __('Enter and confirm one complete email address or phone number with its country code.', 'wconvert'),
                ['status' => 400]
            );
        }

        return new WP_REST_Response($this->erasure->erase($canonical));
    }

    /**
     * @return array{days: int|null, max_days: int}
     */
    private function retentionState(): array
    {
        return ['days' => $this->retention->days(), 'max_days' => RetentionPeriod::MAX_DAYS];
    }
}
