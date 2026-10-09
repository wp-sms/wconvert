<?php

namespace WConvert\Protection;

use WConvert\Storage\TransientStore;

defined('ABSPATH') || exit;

/** Bounded, approximate operational totals. No tokens, addresses or form values. */
final class Diagnostics
{
    public const KEY = 'wconvert_protection_totals';
    public const WINDOW = 86400;
    private const REASONS = ['honeypot', 'rate_limit', 'challenge_failed', 'provider_unavailable', 'verified', 'filter', 'send_limited'];
    public function __construct(private readonly TransientStore $store) {}

    /** @return array{since: int, counts: array<string, int>} */
    public function read(): array
    {
        $data = $this->store->get(self::KEY);
        if (!is_array($data) || !is_int($data['since'] ?? null) || $data['since'] + self::WINDOW <= time()) {
            return ['since' => time(), 'counts' => []];
        }
        return ['since' => $data['since'], 'counts' => array_intersect_key((array) ($data['counts'] ?? []), array_flip(self::REASONS))];
    }

    public function record(string $reason): void
    {
        if (!in_array($reason, self::REASONS, true)) { return; }
        $data = $this->read();
        $data['counts'][$reason] = min(2147483647, ($data['counts'][$reason] ?? 0) + 1);
        $this->store->set(self::KEY, $data, max(1, $data['since'] + self::WINDOW - time()));
    }
}
