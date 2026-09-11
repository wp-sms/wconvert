<?php

namespace WConvert\Destination\MailPoet;

defined('ABSPATH') || exit;

/**
 * The four MailPoet operations the push uses, and no others.
 *
 * **The adapter couples to MailPoet in-process**, which is the whole reason
 * this [[Destination]] is free: it stores its subscribers in the same database
 * and hands other plugins a PHP API, so registering it spends nothing free has
 * promised not to spend (ADR 0007, #87). Nothing here reaches the network.
 *
 * ========================================================================
 * THE SEAM CANNOT REPORT A SUBSCRIBER'S STATUS, AND THAT IS THE DESIGN.
 * ========================================================================
 * {@see self::find()} answers an id and a list of memberships. It does **not**
 * answer whether that person is subscribed, unconfirmed, unsubscribed or
 * bounced — so nothing above this interface can branch on a lifecycle state it
 * has no way to read, and ADR 0022's "branching on `status` to decide anything
 * IS reading it" is enforced by the shape rather than remembered by whoever
 * edits next.
 *
 * The mirror rule holds on the way out. There is no `unsubscribe`, no
 * `updateSubscriber`, no `untag` and no status write of any kind, because the
 * push performs none of them: matching a subscriber means meeting a system
 * that already holds an opinion about that person, and the owner's opinion
 * wins — including the opinion that they left. A method absent from this
 * interface is a thing the adapter cannot do by accident, which is exactly
 * what {@see \WConvert\Destination\Wsms\WsmsContacts} says one file over.
 *
 * **{@see self::join()} is the one that is easy to get wrong**, and
 * {@see WpMailPoetSubscribers} is where the argument lives: MailPoet's own
 * public `subscribeToLists()` sets a non-subscribed subscriber's global status
 * on the way past, so the whole point of this method is that it is *not* that
 * call.
 *
 * @since 0.1.0
 */
interface MailPoetSubscribers
{
    /**
     * The site's MailPoet lists, **by name** — an admin-time read of the
     * provider's SHAPE and never of a person's state (ADR 0007).
     *
     * It is what stops the merchant pasting a numeric segment id into a text
     * box, and it is the one method here that a REST read calls. On a site
     * with no MailPoet it answers `[]` rather than throwing: the type is
     * `unavailable` there and its schema is still rendered, because
     * `DestinationController::index()` reads every registered type's schema
     * whatever its [[Availability]].
     *
     * **Pairs rather than a map**, and that is not a style choice: MailPoet's
     * list ids are integers, and PHP silently coerces a numeric-STRING array
     * key to an int — so a map would hand its caller a shape that changes
     * depending on what the merchant happened to name their lists.
     *
     * @return list<array{id: string, name: string}>
     */
    public function lists(): array;

    /** Active custom text fields, read at admin time or to validate a configured mapping.
     * @return list<array{id: string, name: string}>
     */
    public function textFields(): array;

    /**
     * A subscriber MailPoet has never heard of, on `$listIds`.
     *
     * **The status is MailPoet's to choose, not ours.** Its own
     * signup-confirmation setting decides whether the new subscriber is
     * `subscribed` or `unconfirmed` with a confirmation email behind it, and
     * that is the site's decision (ADR 0016 — WConvert never confirms an
     * [[Optin]] and has no opinion about who is subscribed).
     *
     * @param array<string, string> $subscriber MailPoet's own column names.
     * @param list<string> $listIds
     * @return string The new subscriber's id.
     * @throws SubscriberExists When MailPoet already holds that address.
     */
    public function add(array $subscriber, array $listIds): string;

    /**
     * Match by email — **the id and the memberships, and nothing else.**
     *
     * `lists` holds every list MailPoet has a membership row for, **whatever
     * that row's status**. It is read to decide what NOT to write: a row that
     * exists is an opinion the owning system already recorded, including the
     * opinion that they left this particular list, so the push adds the ones
     * that are missing and leaves the rest alone. That is ADR 0022's
     * fill-blanks rule at list scope — reading a stored value in order to
     * avoid overwriting it.
     *
     * @return array{id: string, lists: list<string>}|null
     */
    public function find(string $email): ?array;

    /**
     * Create a membership row on each of `$listIds`.
     *
     * **Additive, and it never touches the subscriber's own status.** The
     * caller has already removed the lists MailPoet holds a row for, so every
     * id here is a list this person has no recorded opinion about.
     *
     * @param list<string> $listIds
     */
    public function join(string $subscriberId, array $listIds): void;
}
