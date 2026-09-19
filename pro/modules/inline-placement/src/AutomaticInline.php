<?php

namespace WConvert\Pro\Module\InlinePlacement;

use WConvert\Frontend\Payload;
use WConvert\Frontend\RequestContextFactory;
use WConvert\Optin\InlinePlacement;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Support\Ulid;
use WConvert\Targeting\RoleRegistry;

defined('ABSPATH') || exit;

/** Outputs candidates only. Visitor eligibility and the winner remain client-side. */
final class AutomaticInline
{
    private bool $inserted = false;

    public function __construct(
        private readonly PublishedSet $published,
        private readonly Degradation $degradation,
        private readonly RoleRegistry $roles,
    ) {
    }

    public function hooks(): void
    {
        add_filter('the_content', [$this, 'content'], 20);
        add_filter('render_block_core/post-content', [$this, 'block'], 20, 3);
    }

    public function content(string $html): string
    {
        // Block themes have an explicit Post Content boundary below; nested
        // Query Loops must never consume the main article's placement.
        if (wp_is_block_theme() || !in_the_loop() || !is_main_query()
            || count(array_keys($GLOBALS['wp_current_filter'] ?? [], 'the_content', true)) > 1) {
            return $html;
        }
        return $this->place($html, (int) get_the_ID());
    }

    /** @param array<string, mixed> $parsed */
    public function block(string $html, array $parsed, \WP_Block $block): string
    {
        if (!wp_is_block_theme() || isset($block->context['queryId'])) {
            return $html;
        }
        // core/post-content owns exactly one wrapper. Keep that wrapper and
        // all its attributes verbatim, and insert inside it, never beside it.
        if (!preg_match('~\A(<(div|main|section|article)\b[^>]*>)(.*)(</\2>)\z~s', $html, $parts)) {
            return $html;
        }
        return $parts[1] . $this->place($parts[3], (int) ($block->context['postId'] ?? 0)) . $parts[4];
    }

    private function place(string $html, int $postId): string
    {
        if ($this->inserted || trim($html) === '' || is_admin() || is_feed() || is_preview()
            || (defined('REST_REQUEST') && REST_REQUEST) || doing_filter('get_the_excerpt')
            || !is_singular(['post', 'page']) || $postId !== get_queried_object_id()
            || post_password_required($postId)
            || get_post_meta($postId, '_elementor_edit_mode', true) === 'builder'
            || get_post_meta($postId, '_et_pb_use_builder', true) === 'on') {
            return $html;
        }
        $set = PublishedOptin::fromSet($this->published->all());
        $entries = Payload::forRequest($set, RequestContextFactory::forPublishedSet($set, $this->roles), $this->degradation);
        $result = self::insertCandidates($html, $entries);
        $this->inserted = $result !== $html;
        return $result;
    }

    /** @param list<array<string, mixed>> $entries */
    public static function insertCandidates(string $html, array $entries): string
    {
        $seen = [];
        // Derive all boundaries from the original article, not from anchors
        // already inserted by another candidate. Offsets remain byte-stable.
        $insertions = [];
        foreach ($entries as $entry) {
            $id = $entry['anchor'] ?? $entry['id'] ?? '';
            $placement = InlinePlacement::normalize($entry['inline_placement'] ?? null);
            if (($entry['display_type'] ?? '') !== 'inline' || $placement === null
                || !is_string($id) || !Ulid::isOne($id)) {
                continue;
            }
            // Each A/B arm has a candidate at its configured position. Only
            // the assigned arm may promote its candidate to the family anchor.
            $candidateId = (string) ($entry['id'] ?? '');
            if (!Ulid::isOne($candidateId) || isset($seen[$candidateId])) {
                continue;
            }
            $seen[$candidateId] = true;
            $marker = '<div hidden data-wconvert-auto="' . esc_attr($candidateId) . '" data-wconvert-owner="' . esc_attr($id) . '"></div>';
            if (str_contains($html, $marker)) {
                continue;
            }
            $placed = ContentInsertion::insert($html, $marker, $placement);
            $at = strpos($placed, $marker);
            if ($at !== false) {
                $insertions[$at] = ($insertions[$at] ?? '') . $marker;
            }
        }
        krsort($insertions, SORT_NUMERIC);
        foreach ($insertions as $offset => $markers) {
            $html = substr($html, 0, $offset) . $markers . substr($html, $offset);
        }
        return $html;
    }
}
