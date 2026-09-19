<?php

namespace WConvert\Rest;

use WConvert\Storage\TransientStore;

defined('ABSPATH') || exit;

/** A generous per-campaign capture limit whose short-lived key contains only a site HMAC. */
final class CaptureRateLimit
{
    private const PREFIX = 'wconvert_capture_';

    public const WINDOW = 600;

    public const ALLOWED = 60;

    public function __construct(
        private readonly TransientStore $transients,
    ) {
    }

    public function allows(string $ip, string $optinId, int $now): bool
    {
        // Do not make a proxy/server configuration problem prevent a real
        // visitor from submitting. Size and field validation still apply.
        if ($ip === '') {
            return true;
        }

        $key = self::PREFIX . substr(wp_hash($ip . '|' . $optinId), 0, 32);
        $bucket = $this->transients->get($key);
        $start = is_array($bucket) ? (int) ($bucket['start'] ?? 0) : 0;
        $hits = is_array($bucket) ? (int) ($bucket['hits'] ?? 0) : 0;

        if ($start + self::WINDOW <= $now) {
            $start = $now;
            $hits = 0;
        }

        $hits++;
        $this->transients->set(
            $key,
            ['start' => $start, 'hits' => $hits],
            max(1, ($start + self::WINDOW) - $now)
        );

        return $hits <= self::ALLOWED;
    }
}
