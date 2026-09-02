<?php

namespace WConvert\Destination\MailPoet;

defined('ABSPATH') || exit;

/**
 * {@see MailPoetSubscribers} over the real MailPoet — **the whole of the
 * cross-plugin coupling, in one file.**
 *
 * Everything is reached by STRING — the class names, the service ids and the
 * method names are all resolved at runtime rather than imported. That is not
 * squeamishness: WConvert must load and run on a site with no MailPoet at all
 * ([[Standalone]]), and a `use MailPoet\API\API` here would be a hard
 * reference to a class that is usually absent. The [[Availability]] check
 * upstream is what stops a push being attempted on such a site; this file is
 * written so that even reaching it is survivable, which matters because
 * `DestinationController::index()` calls {@see self::lists()} for every
 * registered type whatever its Availability.
 *
 * It is the same shape {@see \WConvert\Destination\Wsms\WpWsmsContacts} takes
 * over WSMS, down to {@see self::call()}: a method invoked through a variable
 * is a method PHPStan cannot check, which is the honest position when the
 * class it would check against is not on this machine.
 *
 * ========================================================================
 * WHY THIS DOES NOT CALL MailPoet's OWN `subscribeToLists()`.
 * ========================================================================
 * That is the obvious method, it is on the documented `MP('v1')` API, and it
 * is **wrong here**. Its own body reads:
 *
 *     if ($subscriber->getStatus() !== SubscriberEntity::STATUS_SUBSCRIBED) {
 *       … setStatus(UNCONFIRMED) or setStatus(SUBSCRIBED) …
 *
 * so adding a list to somebody who unsubscribed moves them back out of
 * `unsubscribed` on the way past. That is the silent cross-plugin
 * resurrection ADR 0022 exists to refuse, and MailPoet gates on status at
 * SEND time exactly as WSMS does — so declining to write one costs nothing,
 * and asserting one revives a person who left.
 *
 * The status-preserving write is `SubscriberSegmentRepository`, a
 * `setPublic(true)` service in MailPoet's own container and the class
 * `subscribeToLists()` itself delegates the membership half to. Reaching it
 * means reaching past the `MP('v1')` facade, and that is a trade taken
 * deliberately: the facade offers no way to add a list without also writing a
 * lifecycle state, and a [[Destination]] that cannot honour ADR 0022 has no
 * business shipping. The coupling is one facade, three container services and
 * one walk over the subscriber entity's own memberships, all in this file —
 * which is the thing to read on the day MailPoet moves any of them. The
 * exception codes it reads are `public` rather than `private`, so
 * `bin/verify-destinations.php` can hold them against MailPoet's own
 * `APIException` on a site that has one.
 *
 * **The public API is still used wherever it can be.** {@see self::lists()}
 * and {@see self::add()} are `MP('v1')`, because `addSubscriber()` writes the
 * status of a person MailPoet has never heard of — which is exactly the call
 * whose answer belongs to MailPoet's own signup-confirmation setting and not
 * to us (ADR 0016).
 *
 * **No HTTP, anywhere.** Every call below is a PHP call into a plugin in this
 * process, reading and writing tables in this database — which is what makes
 * this Destination free at all (ADR 0007, #87). Asserted rather than
 * reviewed, in
 * {@see \WConvert\Tests\Unit\Contract\TheFreeCapturePathStaysInProcessTest}.
 *
 * Named `WpMailPoetSubscribers` on the repo's own convention —
 * `WpWsmsContacts implements WsmsContacts`, `WpSitePresence implements
 * SitePresence`.
 *
 * @since 0.1.0
 */
final class WpMailPoetSubscribers implements MailPoetSubscribers
{
    /** The class that owns MailPoet's container, and what "MailPoet is loaded" means. */
    private const CONTAINER = 'MailPoet\\DI\\ContainerWrapper';

    /** MailPoet's documented entry point for other plugins. */
    private const API = 'MailPoet\\API\\API';

    /** The membership write that does not touch a subscriber's status. See the class docblock. */
    private const SEGMENT_MEMBERSHIPS = 'MailPoet\\Subscribers\\SubscriberSegmentRepository';

    private const SUBSCRIBERS = 'MailPoet\\Subscribers\\SubscribersRepository';

    private const SEGMENTS = 'MailPoet\\Segments\\SegmentsRepository';

    /**
     * The only segment kind a subscriber can be added to.
     *
     * `getLists()` offers `default` segments alone, so anything else reaching
     * {@see self::join()} is a stored id that has since become a dynamic
     * segment or the WordPress-users list — a query, or somebody else's
     * membership rule, and neither has a row to insert. It is the same reading
     * ADR 0023 takes of `wsms_lists`.
     */
    private const LIST_SEGMENT = 'default';

    /**
     * MailPoet's own `APIException::SUBSCRIBER_EXISTS`.
     *
     * **Public because a number copied out of another plugin goes stale
     * silently.** `bin/verify-destinations.php` reads MailPoet's own class on
     * a site that has one and holds this to it, which is the only place the
     * two can be compared: the unit suite has no MailPoet, and a fake that
     * threw the right exception for the wrong reason would prove nothing.
     */
    public const CODE_SUBSCRIBER_EXISTS = 12;

    /**
     * `CONFIRMATION_FAILED_TO_SEND` and `WELCOME_FAILED_TO_SEND`.
     *
     * **The subscriber landed and the lists are on them**; what failed is an
     * email MailPoet decided to send and owns the sending of, and it says so
     * on its own screens. Treating that as our failure would mark the
     * Destination unhealthy for something that is not about the push, so it
     * resolves the way an existing subscriber does — by id, from a read.
     *
     * Public for the reason above, and checked against
     * `APIException::CONFIRMATION_FAILED_TO_SEND` and
     * `::WELCOME_FAILED_TO_SEND` in the same place.
     */
    public const CODES_LANDED_ANYWAY = [10, 17];

    /**
     * Whether this site can be pushed to at all.
     *
     * Asked before anything else touches MailPoet, so a site that has it
     * deactivated gets a clean answer rather than a fatal.
     */
    public static function isAvailable(): bool
    {
        return class_exists(self::CONTAINER, false);
    }

    public function lists(): array
    {
        if (!self::isAvailable()) {
            // A site with no MailPoet has no lists to offer, and this is a
            // REST read rather than a push — it must answer, not throw.
            return [];
        }

        try {
            $found = $this->call($this->api(), 'getLists');
        } catch (\Throwable $unreachable) {
            // A MailPoet that is loaded but cannot answer leaves the merchant
            // with a field and no options, which is the same thing an install
            // with no lists yet shows them. Throwing here would take the whole
            // Destinations screen down with it.
            unset($unreachable);

            return [];
        }

        $named = [];

        foreach (is_array($found) ? $found : [] as $list) {
            // Trashed lists are left out. MailPoet still returns one, and
            // offering a merchant a list they binned is offering a choice that
            // stops working the moment somebody empties the trash.
            if (!is_array($list) || ($list['deleted_at'] ?? null) !== null) {
                continue;
            }

            $id = (string) ($list['id'] ?? '');
            $name = (string) ($list['name'] ?? '');

            if ($id !== '' && $name !== '') {
                $named[] = ['id' => $id, 'name' => $name];
            }
        }

        return $named;
    }

    public function add(array $subscriber, array $listIds): string
    {
        try {
            $created = $this->call($this->api(), 'addSubscriber', [$subscriber, $this->numeric($listIds)]);

            return (string) (is_array($created) ? ($created['id'] ?? '') : '');
        } catch (\Throwable $failure) {
            $code = $failure->getCode();

            if ($code === self::CODE_SUBSCRIBER_EXISTS) {
                // NOT escaped, and for the reason `WpWsmsContacts::call()`
                // spells out one directory over: every path through this class
                // runs inside {@see MailPoetDestinationType::push()}'s
                // `catch (\Throwable)`, so this cannot reach a page — what the
                // message becomes is `PushResult::reason`, which is stored and
                // rendered through React as operator text. `esc_html()` here
                // would be corruption rather than safety.
                // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- caught by push() and stored as operator text; see above.
                throw new SubscriberExists($failure->getMessage(), 0, $failure);
            }

            if (in_array($code, self::CODES_LANDED_ANYWAY, true)) {
                $existing = $this->find((string) ($subscriber['email'] ?? ''));

                if ($existing !== null) {
                    return $existing['id'];
                }
            }

            throw $failure;
        }
    }

    public function find(string $email): ?array
    {
        $subscriber = $this->call($this->service(self::SUBSCRIBERS), 'findOneBy', [['email' => $email]]);

        if (!is_object($subscriber)) {
            return null;
        }

        $lists = [];
        $memberships = $this->call($subscriber, 'getSubscriberSegments');

        // Read off the entity already in hand rather than through a second
        // repository, and read for ONE purpose: to decide which lists to leave
        // alone. Every row counts whatever its status — a membership somebody
        // unsubscribed from is still an opinion the owning system recorded
        // (ADR 0022) — which is why nothing here looks at one.
        foreach (is_iterable($memberships) ? $memberships : [] as $membership) {
            $segment = is_object($membership) ? $this->call($membership, 'getSegment') : null;

            if (is_object($segment)) {
                $lists[] = (string) $this->call($segment, 'getId');
            }
        }

        return [
            'id' => (string) $this->call($subscriber, 'getId'),
            'lists' => array_values(array_unique($lists)),
        ];
    }

    public function join(string $subscriberId, array $listIds): void
    {
        $subscriber = $this->call($this->service(self::SUBSCRIBERS), 'findOneById', [$subscriberId]);

        if (!is_object($subscriber)) {
            throw new \RuntimeException('MailPoet no longer holds that subscriber.');
        }

        $found = $this->call($this->service(self::SEGMENTS), 'findByIds', [$this->numeric($listIds)]);

        $lists = array_values(array_filter(
            is_array($found) ? $found : [],
            fn ($segment): bool => is_object($segment)
                && $this->call($segment, 'getType') === self::LIST_SEGMENT
        ));

        if ($lists === []) {
            return;
        }

        // **The status-preserving write.** See the class docblock for why this
        // is not `MP('v1')->subscribeToLists()`.
        $this->call($this->service(self::SEGMENT_MEMBERSHIPS), 'subscribeToSegments', [$subscriber, $lists]);
    }

    /**
     * MailPoet holds segment ids as integers; a Destination's settings bag
     * holds whatever the admin stored, which is strings.
     *
     * @param list<string> $listIds
     * @return list<int>
     */
    private function numeric(array $listIds): array
    {
        return array_values(array_map(static fn (string $id): int => (int) $id, $listIds));
    }

    /**
     * `MailPoet\API\API::MP('v1')`, by name.
     *
     * @return object MailPoet's `API\MP\v1\API`.
     */
    private function api(): object
    {
        $this->requireMailPoet();

        // By name, not by import. The guard above is what makes this safe to
        // reach at all — on a Standalone site the class is simply not there,
        // and a `use MailPoet\API\API` at the top of this file would be a hard
        // reference to it either way.
        $accessor = [self::API, 'MP'];
        $api = $accessor('v1');

        if (!is_object($api)) {
            throw new \RuntimeException('MailPoet did not supply its plugin API.');
        }

        return $api;
    }

    /**
     * One of MailPoet's own `setPublic(true)` container services.
     */
    private function service(string $id): object
    {
        $this->requireMailPoet();

        $accessor = [self::CONTAINER, 'getInstance'];
        $container = $accessor();

        if (!is_object($container)) {
            throw new \RuntimeException('MailPoet did not supply its container.');
        }

        $service = $this->call($container, 'get', [$id]);

        if (!is_object($service)) {
            throw new \RuntimeException('MailPoet did not supply ' . $id . '.');
        }

        return $service;
    }

    /**
     * One call into MailPoet.
     *
     * Through a variable rather than as a literal method, for the reason the
     * class docblock gives: the class this would be checked against is not on
     * the machine that runs the analyser, and pretending otherwise means
     * maintaining a fiction of MailPoet's signatures beside the real ones.
     *
     * @param list<mixed> $arguments
     * @return mixed
     */
    private function call(object $target, string $method, array $arguments = [])
    {
        return $target->{$method}(...$arguments);
    }

    private function requireMailPoet(): void
    {
        if (!self::isAvailable()) {
            throw new \RuntimeException('MailPoet is not loaded on this site.');
        }
    }
}
