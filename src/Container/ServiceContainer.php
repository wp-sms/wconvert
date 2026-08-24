<?php

namespace WConvert\Container;

use WConvert\Exception\ServiceNotFoundException;

defined('ABSPATH') || exit;

/**
 * Lazy singleton service container.
 *
 * Holds factories, each called once on first resolution. One instance serves
 * both plugins: Pro binds into the container free created rather than standing
 * up a second one (ADR 0015).
 *
 * It is deliberately small — register, get, resolve. WSMS's container also
 * offers aliases, pre-built singletons and a has() probe, and this will
 * probably want some of them; it gains each one with the caller that needs it.
 * Copying the whole surface now would be scaffolding for needs no ticket has
 * yet, which is the habit ADR 0029's "nothing is written before its subject"
 * exists to break.
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
}
