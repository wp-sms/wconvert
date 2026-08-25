<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * Everything the Targeting axis is allowed to know about the current request.
 *
 * A plain value object, built once per request from WordPress's query state
 * and then never consulted again — which is what keeps
 * {@see TargetingEvaluator} a pure function and testable with no WordPress at
 * all.
 *
 * @since 0.1.0
 */
final class RequestContext
{
    /**
     * @param string    $path       Request path, leading slash, no query string.
     * @param list<int> $termIds    Every term on this request — the queried term on
     *                              a term archive, and the terms attached to the post
     *                              on a singular request.
     */
    public function __construct(
        public readonly string $path = '/',
        public readonly bool $isSingular = false,
        public readonly ?int $postId = null,
        public readonly ?string $postType = null,
        public readonly ?string $archivePostType = null,
        public readonly array $termIds = [],
        public readonly bool $isLoggedIn = false,
    ) {
    }
}
