<?php

namespace WConvert\Agent;

use WP_Error;

defined('ABSPATH') || exit;

/**
 * The shapes every agent reply shares, and the guard every reply passes.
 *
 * A reply names things beside their ids, writes dates as the wall time a
 * merchant set with the site's timezone beside it, pages long lists, and says
 * what to do next. An agent reads replies as a new hire reads a screen, so
 * the words are WConvert's (CONTEXT.md) rather than the storage's.
 */
final class Reply
{
    public const PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    /**
     * Keys no reply carries, at any depth: a design's node tree and tokens,
     * its form definitions, and anything that could hold a [[Lead]].
     */
    private const NEVER = ['tree', 'tokens', 'submissions', 'lead', 'leads', 'lead_id', 'email', 'phone', 'contact', 'contacts', 'values', 'ip', 'user_agent'];

    /**
     * A wall time as the merchant set it, with the zone it is read in.
     *
     * @return array{wall: string, timezone: string}|null
     */
    public static function when(mixed $wall): ?array
    {
        return is_string($wall) && $wall !== '' ? ['wall' => $wall, 'timezone' => self::timezone()] : null;
    }

    public static function timezone(): string
    {
        $zone = wp_timezone_string();
        return $zone === '' ? 'UTC' : $zone;
    }

    /**
     * One page of a list, with how many there are in all.
     *
     * @param list<mixed> $items
     * @param array<string, mixed> $input
     * @return array{items: list<mixed>, page: int, per_page: int, total: int}
     */
    public static function paged(array $items, array $input): array
    {
        $perPage = max(1, min(self::MAX_PER_PAGE, (int) ($input['per_page'] ?? self::PER_PAGE)));
        $page = max(1, (int) ($input['page'] ?? 1));
        return ['items' => array_slice($items, ($page - 1) * $perPage, $perPage), 'page' => $page, 'per_page' => $perPage, 'total' => count($items)];
    }

    /**
     * The reply with every key in {@see self::NEVER} taken out, at any depth.
     *
     * The last line of defence rather than the first: each ability already
     * builds its reply from named fields. This holds when one forgets.
     */
    public static function guard(mixed $reply): mixed
    {
        if (!is_array($reply)) return $reply;
        $out = [];
        foreach ($reply as $key => $value) {
            if (is_string($key) && in_array($key, self::NEVER, true)) continue;
            $out[$key] = self::guard($value);
        }
        return $out;
    }

    /** Something the agent named does not exist, and how to find what does. */
    public static function notFound(string $message): WP_Error
    {
        return new WP_Error('wconvert_agent_not_found', $message, ['status' => 404]);
    }

    /** The agent asked for something it can fix by asking differently. */
    public static function refused(string $message, string $code = 'wconvert_agent_invalid'): WP_Error
    {
        return new WP_Error($code, $message, ['status' => 400]);
    }

    /**
     * A refusal one of WConvert's routes made, passed on as it was made.
     *
     * @param array{status: int, data: mixed} $result {@see \WConvert\Rest\InternalRest::run()}.
     */
    public static function fromRest(array $result, string $fallback): WP_Error
    {
        $data = is_array($result['data']) ? $result['data'] : [];
        return new WP_Error(
            is_string($data['code'] ?? null) ? $data['code'] : 'wconvert_agent_refused',
            is_string($data['message'] ?? null) ? $data['message'] : $fallback,
            (is_array($data['data'] ?? null) ? $data['data'] : []) + ['status' => $result['status']]
        );
    }

    /**
     * The paging parameters every list takes.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function pageSchema(): array
    {
        return [
            'page' => ['type' => 'integer', 'minimum' => 1, 'default' => 1, 'description' => 'Which page of results, from 1.'],
            'per_page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => self::MAX_PER_PAGE, 'default' => self::PER_PAGE, 'description' => 'How many per page, up to 50.'],
        ];
    }

    /**
     * An input schema: an object of these properties and nothing else.
     *
     * No union types anywhere — the MCP Adapter's validator rejects
     * `["integer", "null"]` — so an optional value is simply left out.
     *
     * @param array<string, array<string, mixed>> $properties
     * @param list<string> $required
     * @return array<string, mixed>
     */
    public static function input(array $properties, array $required = []): array
    {
        $schema = ['type' => 'object', 'additionalProperties' => false, 'default' => []];
        if ($properties !== []) $schema['properties'] = $properties;
        if ($required !== []) $schema['required'] = $required;
        return $schema;
    }
}
