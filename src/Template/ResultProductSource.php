<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** A category plus up to three explicit global attribute values; all must match. */
final class ResultProductSource
{
    /** @return array{category_id: int, attributes: list<array{taxonomy: string, term_id: int}>} */
    public static function normalize(mixed $input): array
    {
        // Never discard a bad filter and accidentally recommend a wider category.
        return self::valid($input, true) ? $input : ['category_id' => 0, 'attributes' => []];
    }

    public static function valid(mixed $source, bool $draft = false): bool
    {
        if (!is_array($source) || array_diff(array_keys($source), ['category_id', 'attributes']) !== []
            || !is_int($source['category_id'] ?? null) || $source['category_id'] < ($draft ? 0 : 1)
            || !is_array($source['attributes'] ?? null) || !array_is_list($source['attributes']) || count($source['attributes']) > 3) return false;
        $seen = [];
        foreach ($source['attributes'] as $filter) {
            if (!is_array($filter) || array_diff(array_keys($filter), ['taxonomy', 'term_id']) !== []
                || !is_string($filter['taxonomy'] ?? null) || (!($draft && $filter['taxonomy'] === '') && !preg_match('/^pa_[a-z0-9_\-]{1,29}$/D', $filter['taxonomy']))
                || isset($seen[$filter['taxonomy']]) || !is_int($filter['term_id'] ?? null) || $filter['term_id'] < ($draft ? 0 : 1)) return false;
            $seen[$filter['taxonomy']] = true;
        }
        return true;
    }

    /** Existence is checked on every read: deleted references must fail closed. */
    public static function available(mixed $source): bool
    {
        if (!class_exists('WooCommerce') || !self::valid($source) || !term_exists($source['category_id'], 'product_cat')) return false;
        foreach ($source['attributes'] as $filter) {
            if (!is_object_in_taxonomy('product', $filter['taxonomy']) || !term_exists($filter['term_id'], $filter['taxonomy'])) return false;
        }
        return true;
    }
}
