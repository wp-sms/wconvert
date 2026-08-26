<?php

namespace WConvert\Destination\Wsms;

defined('ABSPATH') || exit;

/**
 * The five WSMS [[Contact]] operations the push uses, and no others.
 *
 * **The adapter couples to the PHP repository, not to REST.** WSMS's REST
 * controller is an admin console API whose permission callback fails for an
 * anonymous capture, and there is no cross-plugin HTTP hop worth paying for
 * when both plugins are in one process (#5).
 *
 * It is an interface for the ordinary reason plus a structural one. The
 * ordinary reason is that the unit suite has no WSMS to call. The structural
 * one is that WSMS disclaims back-compatibility and may change without notice,
 * so the whole of the coupling is five methods in one file — the thing to read
 * when it does.
 *
 * **What is NOT here is the design.** There is no `updateStatus`, no
 * `clearChannelOptOut`, no `removeTag` and no engagement write, because the
 * push performs none of them: matching a Contact means meeting a system that
 * already holds an opinion about that person, and the owner's opinion wins
 * (ADR 0022, ADR 0024). A method absent from this interface is a thing the
 * adapter cannot do by accident.
 *
 * @since 0.1.0
 */
interface WsmsContacts
{
    /**
     * @return array<string, mixed>|null The Contact row, or null.
     */
    public function findByEmail(string $email): ?array;

    /**
     * @return array<string, mixed>|null The Contact row, or null.
     */
    public function findByPhone(string $phone): ?array;

    /**
     * Create a Contact, **with WSMS's own events firing**.
     *
     * `$suppressEvents` is not a parameter here because it is not a choice:
     * the adapter always lets `wsms_contact_created` fire, and no setting
     * controls it. That event is a Flow trigger, an outbound webhook and
     * WSMS's own ESP forwarder — the merchant's welcome sequence and tagging
     * rules running on a WConvert capture with no work from us, which is most
     * of the value of integrating at all (ADR 0023).
     *
     * @param array<string, mixed> $contact
     * @return string The new Contact's id.
     * @throws ContactConflict When an identifier is already taken.
     */
    public function create(array $contact): string;

    /**
     * @param array<string, mixed> $contact
     * @throws ContactConflict When an identifier is already taken by another Contact.
     */
    public function update(string $contactId, array $contact): void;

    /**
     * Add a tag. **Added, never reconciled** — removing one WConvert did not
     * set is a lifecycle act, and WSMS's own `addTag()` is an `INSERT IGNORE`
     * that only fires its event on a genuine insert, so a repeat push is
     * naturally idempotent and does not re-trigger Flows (ADR 0023).
     */
    public function addTag(string $contactId, string $tagId): void;
}
