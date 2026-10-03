<?php

namespace WConvert\Frontend;

use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;
use WConvert\Targeting\RoleRegistry;
use WConvert\Targeting\TargetingType;

defined('ABSPATH') || exit;

/**
 * WordPress's query state, narrowed to what Targeting is allowed to see.
 *
 * The one place in the front-end path that touches WordPress globals, which is
 * what keeps {@see \WConvert\Targeting\TargetingEvaluator} pure and testable
 * with no WordPress at all.
 *
 * @since 0.1.0
 */
final class RequestContextFactory
{
    /**
     * Build the context for this request, given the set that will be evaluated
     * against it.
     *
     * The set is a parameter because resolving a post's terms is a query, and
     * this runs on every uncached page load. If no published Optin targets a
     * term, nobody will ask, so nobody pays. This is the ONLY thing in here
     * that is conditional, and it is conditional on the rule vocabulary rather
     * than on the URL — a per-URL cache is exactly what ADR 0003 forbids.
     *
     * **The roles are lazy on the same terms, and for a sharper version of the
     * reason.** WordPress's own answer is cheap, but the seam this asks
     * through is open to a membership or LMS adapter whose answer is a query
     * ({@see RoleRegistry}) — so a site with no role-targeted Optin must not
     * pay for one. Conditional on the rule vocabulary, never on the URL.
     *
     * @param iterable<PublishedOptin> $publishedSet
     */
    public static function forPublishedSet(iterable $publishedSet, RoleRegistry $roles): RequestContext
    {
        $withTerms = false;
        $withRoles = false;

        foreach ($publishedSet as $optin) {
            $withTerms = $withTerms || $optin->targeting->usesType(TargetingType::Term);
            $withRoles = $withRoles || array_filter(\WConvert\Rules\DisplayPlan::rules($optin->payload['display_rules'] ?? []), static fn ($rule) => $rule['type'] === 'role') !== [];

            // Nothing further to learn. The set is walked on every uncached
            // page load, so it stops as soon as both answers are in.
            if ($withTerms && $withRoles) {
                break;
            }
        }

        return self::current($withTerms, $withRoles ? $roles : null);
    }

    /**
     * **Both parameters are required, and neither defaults to the complete
     * context.**
     *
     * A `$withTerms = true` beside a `$roles = null` would default one half to
     * *ask everything* and the other to *ask nothing*, so a caller that
     * supplied neither would silently refuse every role-targeted Optin — which
     * is precisely the silent, site-wide failure this predicate is held apart
     * to prevent, arriving through a default argument instead of through a
     * list.
     */
    public static function current(bool $withTerms, ?RoleRegistry $roles): RequestContext
    {
        $isSingular = is_singular();
        $postId = $isSingular ? get_queried_object_id() : 0;

        return new RequestContext(
            path: self::path(),
            isSingular: $isSingular,
            postId: $postId > 0 ? $postId : null,
            postType: $isSingular ? (get_post_type() ?: null) : null,
            archivePostType: self::archivePostType(),
            termIds: $withTerms ? self::termIds($isSingular, $postId) : [],
            isLoggedIn: is_user_logged_in(),
            roles: $roles === null ? [] : $roles->held(),
        );
    }

    /**
     * The request path, relative to the site root and without its query
     * string.
     *
     * Site-relative because a merchant on a subdirectory install thinks in
     * `/pricing`, not `/blog/pricing`. Query-free because the path is the
     * full-page cache's key: a rule that varied on `?utm_source=` would make
     * the payload vary on it too, and the cache would serve one visitor's
     * payload to the next.
     */
    private static function path(): string
    {
        // esc_url_raw() rather than sanitize_text_field(), which strips
        // percent-encoded octets and would turn a non-ASCII path into a
        // different path.
        $uri = isset($_SERVER['REQUEST_URI']) ? esc_url_raw(wp_unslash($_SERVER['REQUEST_URI'])) : '/';
        $path = (string) (wp_parse_url($uri, PHP_URL_PATH) ?: '/');

        $home = (string) (wp_parse_url(home_url(), PHP_URL_PATH) ?: '');
        $home = rtrim($home, '/');

        if ($home !== '' && str_starts_with($path, $home)) {
            $path = substr($path, strlen($home));
        }

        return $path === '' ? '/' : $path;
    }

    /**
     * The post type whose archive this is, or null.
     *
     * `is_home()` is folded in on purpose: WordPress registers no post type
     * archive for `post`, so the blog index is the `post` archive by every
     * reading except the API's, and a merchant choosing "Posts archive" means
     * that page.
     */
    private static function archivePostType(): ?string
    {
        if (is_post_type_archive()) {
            $type = get_query_var('post_type');

            if (is_array($type)) {
                $type = reset($type);
            }

            return is_string($type) && $type !== '' ? $type : null;
        }

        return is_home() ? 'post' : null;
    }

    /**
     * Every term on this request — the queried term on a term archive, and the
     * terms attached to the post on a singular request.
     *
     * One field, because `term:` is one rule: a merchant choosing "News" means
     * the category page AND the posts in it.
     *
     * @return list<int>
     */
    private static function termIds(bool $isSingular, int $postId): array
    {
        if (is_category() || is_tag() || is_tax()) {
            $term = get_queried_object();

            return $term instanceof \WP_Term ? [$term->term_id] : [];
        }

        if (!$isSingular || $postId <= 0) {
            return [];
        }

        $ids = [];

        foreach (get_object_taxonomies((string) get_post_type($postId)) as $taxonomy) {
            $terms = get_the_terms($postId, $taxonomy);

            if (!is_array($terms)) {
                continue;
            }

            foreach ($terms as $term) {
                $ids[] = (int) $term->term_id;
            }
        }

        return array_values(array_unique($ids));
    }

}
