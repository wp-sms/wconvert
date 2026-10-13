<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * Where a [[Lead]] signed up: the page's path and its five UTM tags.
 *
 * **Every other query parameter is dropped before anything is stored.** A link
 * in an email or an ad routinely carries `?email=` or a session token, and the
 * Lead row would keep it for the retention period. So this keeps a closed list
 * rather than stripping a known-bad one. The loader sends the raw path and
 * query; the filtering is here because the request is the visitor's to forge
 * (ADR 0148).
 *
 * The result lives inside the Lead's existing capture JSON, so it goes when the
 * Lead is erased and needs no column of its own.
 *
 * @since 0.1.0
 */
final class CaptureSource
{
    public const UTM = ['source', 'medium', 'campaign', 'term', 'content'];

    private const MAX_PATH = 512;

    private const MAX_TAG = 200;

    /**
     * @return array{page_url: string, utm: array<string, string|null>}|null
     */
    public static function fromPageUrl(mixed $url): ?array
    {
        if (!is_string($url) || $url === '' || preg_match('/[\x00-\x20\x7f]/', $url) === 1) return null;
        $parts = wp_parse_url($url);
        if ($parts === false || isset($parts['user']) || isset($parts['pass'])) return null;
        if (isset($parts['scheme']) !== isset($parts['host'])) return null;
        if (isset($parts['scheme']) && !in_array(strtolower($parts['scheme']), ['http', 'https'], true)) return null;
        // A protocol-relative URL names a host without a scheme; a relative path names no page.
        if (!isset($parts['scheme']) && !str_starts_with($url, '/')) return null;
        if (!isset($parts['scheme']) && str_starts_with($url, '//')) return null;
        $path = $parts['path'] ?? '/';
        if ($path === '') $path = '/';
        if (strlen($path) > self::MAX_PATH) return null;
        parse_str($parts['query'] ?? '', $query);
        $utm = [];
        $kept = [];
        foreach (self::UTM as $tag) {
            $value = $query['utm_' . $tag] ?? null;
            $utm[$tag] = is_string($value) && trim($value) !== '' && mb_strlen($value) <= self::MAX_TAG ? trim($value) : null;
            if ($utm[$tag] !== null) $kept['utm_' . $tag] = $utm[$tag];
        }
        return ['page_url' => $path . ($kept === [] ? '' : '?' . http_build_query($kept, '', '&', PHP_QUERY_RFC3986)), 'utm' => $utm];
    }
}
