<?php

namespace WConvert\Container;

use WConvert\Exception\ServiceNotFoundException;

defined('ABSPATH') || exit;

/**
 * Lazy singleton service container.
 *
 * Holds factories (called once, on first resolution) and already-built
 * instances. One instance serves both plugins: Pro binds into the container
 * free created rather than standing up a second one (ADR 0015).
 *
 * @since 0.1.0
 */
final class ServiceContainer
{
    private static ?self $instance = null;

    /** @var array<string, callable(self): object> Factories keyed by service id. */
    private array $factories = [];

    /** @var array<string, object> Resolved singletons keyed by service id. */
    private array $instances = [];

    /** @var array<string, string> Alias -> canonical id. */
    private array $aliases = [];

    private function __construct()
    {
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    /**
     * Register a lazy factory. It is called the first time the id is resolved.
     *
     * @param callable(self): object $factory
     */
    public function register(string $id, callable $factory): self
    {
        $this->factories[$id] = $factory;

        return $this;
    }

    /**
     * Store an already-built object as a singleton.
     */
    public function singleton(string $id, object $instance): self
    {
        $this->instances[$id] = $instance;

        return $this;
    }

    /**
     * Point one id at another.
     */
    public function alias(string $alias, string $target): self
    {
        $this->aliases[$alias] = $target;

        return $this;
    }

    public function has(string $id): bool
    {
        $id = $this->aliases[$id] ?? $id;

        return isset($this->instances[$id]) || isset($this->factories[$id]);
    }

    /**
     * Resolve a service, or throw.
     *
     * There is no null-returning variant on purpose. A container that answers
     * "not registered" with null pushes the failure to whichever line first
     * calls a method on it, which is rarely the line that was wrong.
     *
     * @throws ServiceNotFoundException
     */
    public function get(string $id): object
    {
        $id = $this->aliases[$id] ?? $id;

        if (isset($this->instances[$id])) {
            return $this->instances[$id];
        }

        if (isset($this->factories[$id])) {
            return $this->instances[$id] = ($this->factories[$id])($this);
        }

        throw new ServiceNotFoundException(sprintf('WConvert service "%s" is not registered.', $id));
    }

    /**
     * Resolve a service by class name, with the type preserved for callers.
     *
     * @template T of object
     * @param class-string<T> $className
     * @return T
     * @throws ServiceNotFoundException
     */
    public function resolve(string $className): object
    {
        $service = $this->get($className);

        if (!$service instanceof $className) {
            throw new ServiceNotFoundException(
                sprintf('WConvert service "%s" resolved to %s.', $className, $service::class)
            );
        }

        return $service;
    }

    /**
     * Drop every binding. Test-only — the container is a singleton, so a test
     * that registers into it would otherwise leak into the next one.
     */
    public static function reset(): void
    {
        self::$instance = null;
    }
}
