<?php

namespace WConvert\Admin;

use WConvert\Frontend\InspectorEnqueue;
use WConvert\Rest\Routes;
use WP_Admin_Bar;

defined('ABSPATH') || exit;

/**
 * The door into the eligibility inspector, on the page it explains.
 *
 * ============================================================================
 * IT IS ON THE ADMIN BAR BECAUSE THE ANSWER IS ABOUT THE PAGE THE MERCHANT IS
 * ON.
 * ============================================================================
 * The inspector runs on the REAL request: a merchant does not describe a URL,
 * they visit it, because a `RequestContext` cannot be honestly built from a
 * URL (ADR 0048). So the shortest path to it is a link on whatever page they
 * are already looking at when they wonder why nothing appeared — one click,
 * same page, one query parameter added.
 *
 * The Optin list has a door too, and it needs a dialog because it has to ask
 * WHICH page. This one has to ask nothing.
 *
 * **Front end only.** In wp-admin there is no page to inspect, and
 * {@see InspectorEnqueue} returns on `is_admin()` — a node there would link to
 * a URL that renders no panel.
 *
 * **And it is absent once the inspector is already on.** A link that adds a
 * parameter the URL already carries is a link that does nothing, and a
 * merchant who clicked it and saw no change would reasonably conclude the
 * feature is broken.
 *
 * @since 0.1.0
 */
final class InspectorBar
{
    private const NODE_ID = 'wconvert-inspect';

    public function hooks(): void
    {
        add_action('admin_bar_menu', [$this, 'node'], 100);
    }

    public function node(WP_Admin_Bar $bar): void
    {
        // The same capability the panel itself is gated on, named rather than
        // written out — so the link and the thing it links to can never come
        // to disagree about who may have it.
        if (is_admin() || !current_user_can(Routes::MANAGE_CAPABILITY)) {
            return;
        }

        $url = self::currentUrl();

        if ($url === null) {
            return;
        }

        $bar->add_node([
            'id' => self::NODE_ID,
            'title' => __('Why no popup?', 'wconvert'),
            'href' => $url,
            'meta' => [
                'title' => __('Show why each Campaign did or did not appear on this page', 'wconvert'),
            ],
        ]);
    }

    /**
     * This URL with the parameter on it — or null where it already has it.
     *
     * Built from the REQUEST_URI rather than from `get_permalink()`, because
     * the page being inspected may have no permalink at all: a search result,
     * a 404, an archive, the blog index. Those are exactly the pages whose
     * Targeting is hardest to reason about, and half the real tickets are
     * about them.
     */
    private static function currentUrl(): ?string
    {
        $uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash((string) $_SERVER['REQUEST_URI'])) : '';

        if ($uri === '') {
            return null;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Reading whether the diagnostic is already on, to decide whether to offer a link to it.
        if (isset($_GET[InspectorEnqueue::PARAM])) {
            return null;
        }

        return add_query_arg(InspectorEnqueue::PARAM, '1', home_url($uri));
    }
}
