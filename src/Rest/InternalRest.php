<?php

namespace WConvert\Rest;

use WP_REST_Request;

defined('ABSPATH') || exit;

/**
 * One of WConvert's own routes, called from inside the request.
 *
 * ============================================================================
 * WRITES GO THROUGH THE ROUTE THE EDITOR USES.
 * ============================================================================
 * Copy and Import create campaigns this way (ADR 0153), and so does every
 * agent ability that writes (ADR 0154). The args schema, the vocabulary and
 * every refusal in {@see OptinController} then apply exactly as to a typed
 * edit, the current user's capability is checked by the route, and there is
 * no second write path to keep in step.
 */
final class InternalRest
{
    /**
     * @param array<string, mixed> $body
     * @return array{status: int, data: mixed}
     */
    public static function run(string $method, string $route, array $body = []): array
    {
        $request = new WP_REST_Request($method, '/' . Routes::NAMESPACE . $route);
        foreach ($body as $key => $value) {
            $request->set_param($key, $value);
        }
        $response = rest_do_request($request);
        return ['status' => $response->get_status(), 'data' => $response->get_data()];
    }

    /**
     * What a refused call said, or the fallback where it said nothing readable.
     *
     * @param array{status: int, data: mixed} $result
     */
    public static function message(array $result, string $fallback): string
    {
        $data = $result['data'];
        return is_array($data) && is_string($data['message'] ?? null) ? $data['message'] : $fallback;
    }

    /** @param array{status: int, data: mixed} $result */
    public static function failed(array $result): bool
    {
        return $result['status'] >= 400;
    }
}
