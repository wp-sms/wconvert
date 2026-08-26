<?php

namespace WConvert\Rest;

defined('ABSPATH') || exit;

/**
 * A controller that owns REST routes.
 *
 * **The one method is `registerRoutes()`, and there is deliberately no
 * `hooks()` beside it.** Every controller's `hooks()` was the same single line
 * — `add_action('rest_api_init', [$this, 'registerRoutes'])` — so WHEN a
 * controller is wired was written eleven times and WHERE it is built was
 * written nowhere. That cost #52, argued in full in
 * {@see \WConvert\Container\CoreServiceProvider::boot()}.
 *
 * So the hook moved to the provider, which is where the container is, and this
 * is what is left: the controller says what its routes are and says nothing
 * about when. A controller is then free to be built at the moment
 * `rest_api_init` fires, which is the only moment it is needed.
 *
 * @since 0.1.0
 */
interface RestController
{
    /**
     * Declare this controller's routes.
     *
     * Called on `rest_api_init` and at no other time, so anything a route
     * needs may be built here without asking what has already run.
     */
    public function registerRoutes(): void;
}
