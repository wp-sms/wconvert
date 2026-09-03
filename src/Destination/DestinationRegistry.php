<?php

namespace WConvert\Destination;

use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\SitePresence;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The [[Destination]] types this install can reach, and which
 * [[Availability]] state each is in.
 *
 * Free registers the WSMS push. **Pro registers its own types into this same
 * registry** by pulling it out of the shared container from its service
 * provider's `boot()` — the seam is a core-fired lifecycle action plus a
 * shared container, not a filter passing a registry around (ADR 0015).
 *
 * **No third-party registration hook in v1.** WSMS's own
 * `wsms_register_integrations` has zero registrants and all six of its premium
 * modules bypass it via the container. Shipping one speculatively is dead
 * code; it is a ten-line addition the moment a real registrant exists (#4).
 *
 * The three states are resolved here rather than by each type, because
 * `unavailable` beating `locked` is arithmetic that must not be re-derived per
 * surface — a merchant with no WSMS is never sold Pro for a feature Pro would
 * not give them either (ADR 0026).
 *
 * @since 0.1.0
 */
final class DestinationRegistry
{
    /** @var array<string, DestinationType> */
    private array $types = [];

    public function __construct(
        private readonly ProPresence $pro,
        private readonly SitePresence $site,
    ) {
    }

    public function register(DestinationType $type): self
    {
        $this->types[$type->id()] = $type;

        return $this;
    }

    public function find(string $typeId): ?DestinationType
    {
        return $this->types[$typeId] ?? null;
    }

    /**
     * @return array<string, DestinationType>
     */
    public function all(): array
    {
        return $this->types;
    }

    /**
     * One type's Availability on this install.
     *
     * A type that is **not registered at all** is `locked` or `unavailable`
     * depending on why, and this cannot tell which — the code that did not run
     * cannot say why it did not. So an unregistered type reads as `locked`
     * only on a free install, and `unavailable` on any paid one: a broken Pro
     * plugin on a valid licence is not something to sell a licence for.
     *
     * **Asked as "is this install free" rather than "is Pro loaded"**, now that
     * the answer is a ladder rather than a boolean. The two read identically
     * today and will not always: a Basic install that failed to register an
     * Elite type is in the same position as a broken Pro, not in a free one's.
     */
    public function availabilityOf(string $typeId): Availability
    {
        $type = $this->find($typeId);

        if ($type === null) {
            return $this->pro->installedTier() === Tier::Free ? Availability::Locked : Availability::Unavailable;
        }

        $requires = $type->requires();

        return Availability::of(
            $requires === null || $this->site->has($requires),
            $type->tier()->isSuppliedBy($this->pro)
        );
    }

    /**
     * Whether a Destination of this type may be dispatched to right now.
     *
     * **Checked at DISPATCH time**, which is an ordinary server-side runtime
     * check — deliberately unlike the enqueue-time asset gating the rule
     * engine needs, which exists only because rules are browser-evaluated.
     *
     * A Destination whose type is not `ready` is **skipped and recorded, never
     * enqueued**: an Action Scheduler job whose handler is unregistered
     * retries and fails forever, silently. The Optin keeps showing and keeps
     * capturing, because losing captures when a licence lapses would be the
     * one genuinely unrecoverable failure available here (#4).
     *
     * The recording is {@see HealthStore::skipped()}, written by
     * {@see PushDispatcher}. This method only answers the question.
     */
    public function isDispatchable(string $typeId): bool
    {
        return $this->availabilityOf($typeId) === Availability::Ready;
    }
}
