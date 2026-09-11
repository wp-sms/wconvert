<?php

namespace WConvert\Destination;

use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * A kind of [[Destination]] — WSMS, an ESP, a webhook, the lead-magnet email.
 *
 * **One interface, and no `Supports*` capability split.** WSMS's
 * `IntegrationInterface` has fifteen methods across five capability
 * interfaces, and almost none of them has a counterpart here: WConvert has no
 * flow engine, one category, and exactly one capability. The collapse that
 * removes the rest is that **audience discovery is not a capability, it is a
 * schema whose options come from the wire** — {@see self::settingsSchema()}
 * performs the admin-time read, so list discovery, custom-field discovery and
 * the configuration UI all fall out of one method (#4).
 *
 * **A type is STATELESS.** Its configuration arrives per call in a
 * {@see PushContext}, never on the instance, because two Mailchimp audiences
 * are two Destinations over one [[Connection]] and one object cannot be both.
 * This is the modelling break from WSMS, whose integration object *is* the
 * configured instance.
 *
 * **A type declares its own tier and its own site dependency**, and the
 * registry does the [[Availability]] arithmetic. That is ADR 0015's rule kept:
 * each registry declares `tier` locally on members it already enumerates, so
 * the premium split adds no cross-cutting list of premium capabilities.
 *
 * @since 0.1.0
 */
interface DestinationType
{
    /** The stable id a configured Destination references — `wsms`, `mailchimp`. */
    public function id(): string;

    public function label(): string;

    /**
     * A lucide icon name, kebab-case, as lucide itself spells it.
     *
     * **Not a dashicon.** Dashicons is WordPress chrome and ADR 0035 stopped
     * rendering that, so a registry handing out `dashicons-groups` would be
     * the one place the chrome got back in — through the domain rather than
     * through the markup ([ADR 0036](../../docs/adr/0036-admin-components-are-vendored-from-upstream.md)).
     *
     * A name the admin resolves rather than a component, because this is PHP
     * and the admin is where icons live. An unknown name resolves to a
     * fallback rather than to nothing, so a [[Destination]] registered by
     * [[Pro]] against a lucide release this admin predates still draws a row.
     */
    public function icon(): string;

    /** Which install supplies this type. Free ships WSMS; the ESPs are Pro's. */
    public function tier(): Tier;

    /**
     * What the SITE would need for this type to work, or null where it needs
     * nothing. A missing plugin is `unavailable` and never `locked`, because
     * it is not something we can sell (ADR 0026).
     */
    public function requires(): ?SiteDependency;

    /**
     * The credentials schema for the [[Connection]] underneath this type, or
     * **null where the type has none** — a webhook's URL is its whole
     * configuration, and the WSMS push authenticates against nothing.
     *
     * @return array<string, mixed>|null
     */
    public function connectionSchema(): ?array;

    /**
     * The Destination's own settings, including whatever selects the target
     * inside the remote system — the Mailchimp audience, the WSMS tags.
     *
     * It takes the Connection because the options may come from the wire:
     * reading a provider's list of audiences at admin time is a read of its
     * SHAPE, never of a person's state, and it is what stops the merchant
     * pasting an audience id by hand (ADR 0007).
     *
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function settingsSchema(array $credentials): array;

    /** Static prerequisites and field use; no Contact state or provider read. */
    public function requirements(): DestinationRequirements;

    /**
     * Prove the credentials work, or throw.
     *
     * Throwing rather than returning a result mirrors
     * `IntegrationInterface::connect()`'s documented contract rather than
     * inventing a second convention for the same thing.
     *
     * @param array<string, mixed> $credentials
     * @throws \RuntimeException
     */
    public function testConnection(array $credentials): void;

    /**
     * Push one {@see PushSubject}. **This must be idempotent.**
     *
     * That is contract and not an implementation note. A push is not one HTTP
     * call — some vendors need two or three — so a retry re-runs a sequence
     * that may already be half done, and no vendor offers an idempotency
     * header. Every implementation therefore keys on the vendor's own
     * email-keyed upsert, and running this twice for one subject must leave one
     * Contact (ADR 0008).
     *
     * Everything downstream stands on that clause: it is what makes retries
     * safe, what makes bulk re-push a support tool rather than a duplicate
     * generator, and what made a `wconvert_lead_deliveries` table buy
     * efficiency rather than correctness.
     *
     * **It takes a subject rather than a [[Lead]], and that is a decision
     * rather than a widening.** A merchant proving their credentials work sends
     * a test, and a test with a `Lead` in this signature would have to write a
     * row — a capture event that never happened, carrying a [[Consent Record]]
     * nobody was shown (ADR 0031). So what a type receives is the canonical
     * values and a flag saying where they came from; a type reads
     * `$subject->values` exactly as it used to read `CanonicalFields::of()`.
     */
    public function push(PushSubject $subject, PushContext $context): PushResult;

    /**
     * Sustained jobs per minute this type can take.
     *
     * **There is no rate limiter in v1**, and this is what replaces one.
     * Organic capture cannot approach any vendor's limit; only bulk re-push
     * can, so {@see BulkRePush} staggers against this figure and immediate
     * dispatch stays immediate (ADR 0008).
     */
    public function throughput(): int;
}
