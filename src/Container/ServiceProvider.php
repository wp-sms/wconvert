<?php

namespace WConvert\Container;

defined('ABSPATH') || exit;

/**
 * Contract for service providers.
 *
 * Providers go through two phases: `register()` binds factories, `boot()`
 * resolves services and wires hooks. Every provider is registered before any
 * provider is booted, so `boot()` may reach for anything the set declared.
 *
 * @since 0.1.0
 */
interface ServiceProvider
{
    /**
     * Bind factories and singletons into the container.
     */
    public function register(ServiceContainer $container): void;

    /**
     * Resolve services and add hooks. Called after every provider registered.
     */
    public function boot(ServiceContainer $container): void;
}
