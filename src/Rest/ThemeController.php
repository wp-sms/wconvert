<?php

namespace WConvert\Rest;

use WConvert\Template\ThemeTokens;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the site theme's colours and type.
 *
 * One `GET`, and it writes nothing. **Theme inheritance is an opt-in value
 * copy**: what comes back is a token map the settings panel offers to copy
 * into the [[Optin]]'s own tokens, and once copied nothing reads the theme
 * again ({@see ThemeTokens}).
 *
 * A route rather than a field on the templates route, because it is a fact
 * about the SITE and not about a [[Template]] — and because it is read only
 * when a merchant asks for it, which is rarely. The font picker keeps that
 * true: it reads this the first time the popover is opened and not on every
 * visit to the Design tab.
 *
 * @since 0.1.0
 */
final class ThemeController implements RestController
{
    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/theme', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        // An empty map is the honest answer for a classic theme with no
        // `theme.json`: it declares no palette, so there is nothing to copy
        // and the panel says so rather than offering a button that does
        // nothing.
        //
        // **`fonts` rides the same fetch** rather than earning a route. It is
        // the same fact about the same site read out of the same settings, and
        // the panel that asks for one is the panel that asks for the other —
        // a second route would be a second permission check and a second
        // round trip for one answer. It degrades the same way: a classic theme
        // declares no families, the list is empty, and the picker offers the
        // four system stacks it always did
        // (`docs/adr/0055-the-font-list-is-the-sites.md`).
        return new WP_REST_Response([
            'tokens' => ThemeTokens::fromSite(),
            'fonts' => ThemeTokens::fontsFromSite(),
        ]);
    }
}
