<?php

namespace WConvert\Destination\MailPoet;

use WConvert\Destination\CanonicalFields;
use WConvert\Destination\DestinationType;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushSubject;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The MailPoet push — **free's third in-process [[Destination]], and the one
 * that lets `Goal::GrowEmailList` do the thing it names on a [[Standalone]]
 * site.**
 *
 * ========================================================================
 * WHY THIS IS FREE, WHEN EVERY ESP IS PRO.
 * ========================================================================
 * ADR 0007 makes a Destination that calls out over HTTP a [[Pro]] feature, and
 * free's capture path therefore makes **no outbound HTTP request at all** —
 * which is what `readme.txt` prints in bold. Free registers exactly three
 * types, and each is free for one reason repeated: the WSMS push because WP
 * SMS is a sibling plugin in the same process, the lead-magnet delivery
 * because `wp_mail()` is WordPress's own, and this one because MailPoet stores
 * its subscribers in the same database and hands other plugins a PHP API.
 * Registering it spends nothing free has promised not to spend (#87).
 *
 * That promise is asserted rather than reviewed, in
 * {@see \WConvert\Tests\Unit\Contract\TheFreeCapturePathStaysInProcessTest}
 * and again on a real WordPress in `bin/verify-destinations.php`.
 *
 * ========================================================================
 * LIST MEMBERSHIP IS ONLY EVER ADDED, AT BOTH SCOPES.
 * ========================================================================
 * A [[Lead]] arriving must not flip an existing MailPoet subscriber from
 * unsubscribed back to subscribed. That is ADR 0022's rule, and it holds here
 * with the same force and for the same reason: MailPoet filters on status at
 * SEND time, so refusing to write one costs nothing, and asserting
 * `subscribed` would be a silent resurrection of somebody who left —
 * invisible in both admin screens until a complaint arrives.
 *
 * It holds at **list** scope too, which is the half MailPoet adds. A
 * `mailpoet_subscriber_segment` row carries its own status, so a merchant's
 * *"unsubscribe me from Offers, keep me on News"* is a stored opinion — and
 * {@see MailPoetSubscribers::join()} is handed only the lists MailPoet holds
 * no row for at all. Reading the memberships in order to decide what NOT to
 * write is ADR 0022's fill-blanks rule one scope down; it is not a read of
 * lifecycle state, and the seam has no way to report one
 * ({@see MailPoetSubscribers}).
 *
 * **Nothing is filled in on a match**, and that is the one place this differs
 * from the WSMS push. MailPoet's only public update path rewrites `source` and
 * `subscribed_ip` on every call, so filling an empty `first_name` would also
 * restamp the provenance of somebody MailPoet already knows — with an IP
 * WConvert does not have and would not store if it did (ADR 0017), taken from
 * whatever request happened to run the queue. A captured name lands where it
 * is evidence of something: on a subscriber this site has never seen.
 *
 * `settingsSchema()` lists the merchant's own lists **by name**, which is an
 * admin-time read of the provider's shape and never of a person's state
 * (ADR 0007).
 *
 * FluentCRM is the same shape and should follow cheaply. It is not built here.
 *
 * @since 0.1.0
 */
final class MailPoetDestinationType implements DestinationType
{
    public const ID = 'mailpoet';

    /** The lists a captured [[Lead]] is added to. */
    public const LISTS = 'lists';

    public const INTEREST_FIELD = 'interest_field';

    /**
     * Canonical key => MailPoet column. The whole field map, once, for every
     * [[Optin]] (#4).
     *
     * `phone` is absent because MailPoet has no column for one — it is an
     * email tool — and a Lead carrying only a phone is skipped below rather
     * than sent somewhere that cannot hold it.
     */
    private const COLUMNS = [
        CanonicalFields::EMAIL => 'email',
        CanonicalFields::NAME => 'first_name',
    ];

    public function __construct(
        private readonly MailPoetSubscribers $subscribers,
    ) {
    }

    public function id(): string
    {
        return self::ID;
    }

    public function label(): string
    {
        return __('MailPoet', 'wconvert');
    }

    public function icon(): string
    {
        return 'mail-plus';
    }

    public function tier(): Tier
    {
        return Tier::Free;
    }

    /**
     * MailPoet, always. The return type is narrower than the interface's on
     * purpose: this type is meaningless without it, and a `null` here would be
     * a Destination that claims to need nothing while calling into a plugin
     * that may not be there.
     *
     * With MailPoet absent the type is `unavailable` and never `locked` — it
     * is a missing plugin rather than a missing tier, and those are the whole
     * of ADR 0026's distinction. An unavailable type is **skipped and
     * recorded, never enqueued and never thrown on** (#30).
     */
    public function requires(): SiteDependency
    {
        return SiteDependency::MailPoet;
    }

    /**
     * None. There is no key to paste — it is the same site and the same
     * database — so no [[Connection]] is ever created for this type.
     */
    public function connectionSchema(): ?array
    {
        return null;
    }

    /**
     * One field: the lists to add to, **named rather than numbered.**
     *
     * The options DO come off the provider here, which is the one place this
     * type differs from the WSMS push: WSMS's tags are read by the admin
     * itself, and MailPoet's segment ids are integers a merchant has no way to
     * discover except by reading a URL. It is an admin-time read of the
     * provider's SHAPE — a list of names reveals nothing about any person
     * (ADR 0007) — and it is the read that stops the merchant pasting `3`.
     *
     * On a site with no MailPoet {@see MailPoetSubscribers::lists()} answers
     * `[]` and the `options` key is left off, because this method is called
     * for every registered type on every read of the Destinations screen,
     * whatever its [[Availability]].
     *
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function settingsSchema(array $credentials): array
    {
        unset($credentials);

        $lists = $this->subscribers->lists();

        $field = [
            'type' => 'ids',
            'label' => __('Lists to add to', 'wconvert'),
            'description' => __(
                'Adds subscribers to these lists without removing other memberships. MailPoet controls signup confirmation.',
                'wconvert'
            ),
        ];

        if ($lists !== []) {
            $field['options'] = array_map(
                static fn (array $list): array => ['value' => $list['id'], 'label' => $list['name']],
                $lists
            );
        }

        return [self::LISTS => $field, self::INTEREST_FIELD => [
            'type' => 'select',
            'label' => __('Save interest in MailPoet', 'wconvert'),
            'description' => __('Optional: send the answer value to a custom text field for new subscribers. Existing subscribers stay unchanged. Unmapped answers stay in WConvert.', 'wconvert'),
            'options' => array_map(static fn (array $field): array => ['value' => $field['id'], 'label' => $field['name']], $this->subscribers->textFields()),
        ]];
    }

    /**
     * Nothing to prove. There is no [[Connection]] under this type.
     *
     * @param array<string, mixed> $credentials
     */
    public function testConnection(array $credentials): void
    {
        unset($credentials);
    }

    /**
     * ========================================================================
     * THE DECISION TABLE, ARGUED AGAINST ADR 0008 RATHER THAN GUESSED.
     * ========================================================================
     * | Situation                     | Result      | Why                                                                       |
     * |-------------------------------|-------------|---------------------------------------------------------------------------|
     * | The Lead carries no email     | `skipped`   | Routine, and it must stay out of the health count. MailPoet keys on email. |
     * | No list configured            | `retryable` | About the DESTINATION, not this Lead — the same row the lead-magnet type has, for the same reason: a merchant who published before finishing the setup gets health saying so, rather than a ring nothing prompts anyone to read. |
     * | Anything MailPoet throws      | `retryable` | In-process, so there is no HTTP status to misread and no Lead-specific rejection to tell apart. What is left is MailPoet being broken or gone, which is an outage — and re-running the whole of `push()` fixes it, because `push()` is idempotent. |
     *
     * **Idempotent, keyed on email.** A retry re-runs the whole sequence: the
     * match finds the subscriber the first attempt created, and the join is
     * handed only the lists MailPoet holds no row for — which after a
     * completed push is none. Two pushes, one subscriber, one membership.
     */
    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $email = $subject->values[CanonicalFields::EMAIL] ?? '';

        if (!$this->requirements()->acceptsCapture($subject->values)) {
            return PushResult::skipped('MailPoet keys a subscriber on their email address, and this Lead carries none.');
        }

        $lists = $this->configuredLists($context);

        if ($this->requirements()->missingSettings($context->settings) !== []) {
            return PushResult::retryable('No MailPoet list is configured on this Destination.');
        }

        try {
            $subscriber = $this->subscribers->find($email);

            return PushResult::success(
                $subscriber === null
                    ? $this->create($subject->values, $email, $lists, $context)
                    : $this->join($subscriber, $lists)
            );
        } catch (\Throwable $failure) {
            return PushResult::retryable($failure->getMessage());
        }
    }

    public function requirements(): DestinationRequirements
    {
        return new DestinationRequirements(
            ['email'],
            [self::LISTS => ['label' => __('Lists to add to', 'wconvert'), 'type' => 'ids']],
            ['email', 'name'],
            ['interest' => [
                'setting' => self::INTEREST_FIELD,
                'label' => __('Interest', 'wconvert'),
                'scope' => __('New subscribers only; existing subscriber fields stay unchanged.', 'wconvert'),
            ]],
            ['email'],
        );
    }

    /**
     * Thirty a minute, and the figure is about MailPoet's mail rather than
     * about us.
     *
     * Nothing here rate-limits — this is read only by
     * {@see \WConvert\Destination\BulkRePush}'s stagger, and organic capture
     * cannot approach it (ADR 0008). It sits below the WSMS push's 60 because
     * creating a subscriber can hand MailPoet a confirmation email to send
     * synchronously through the site's own transport, and above the
     * lead-magnet email's 6 because a re-push replays Leads that are already
     * subscribers, which sends nothing at all.
     */
    public function throughput(): int
    {
        return 30;
    }

    /**
     * A subscriber MailPoet has never heard of.
     *
     * The `SubscriberExists` branch is a second writer landing the row between
     * our read and our write, and it takes the same answer as an ordinary
     * match one call earlier: **the subscriber this Lead was going to become
     * already exists**, so finish by adding the list. It is also what a retry
     * of a sequence that died between the create and the subscribe walks into.
     *
     * A re-read that still finds nothing means the index says the address is
     * taken and no read can find who holds it. Nothing here resolves that, so
     * the original throw goes back up and becomes a queued retry — which is
     * free, because `push()` is idempotent.
     *
     * @param array<string, string> $values
     * @param list<string> $lists
     */
    private function create(array $values, string $email, array $lists, PushContext $context): string
    {
        try {
            $subscriber = $this->newSubscriber($values);
            $mapping = DestinationRequirements::text($context->settings[self::INTEREST_FIELD] ?? null);
            if ($mapping !== '' && isset($values['interest'])) {
                $valid = array_column($this->subscribers->textFields(), 'id');
                if (!in_array($mapping, $valid, true)) {
                    throw new \RuntimeException('The configured MailPoet interest text field is unavailable. Review this Destination’s settings.');
                }
                $subscriber[$mapping] = $values['interest'];
            }
            return $this->subscribers->add($subscriber, $lists);
        } catch (SubscriberExists $raced) {
            $existing = $this->subscribers->find($email);

            if ($existing === null) {
                throw $raced;
            }

            return $this->join($existing, $lists);
        }
    }

    /**
     * The lists MailPoet holds **no row at all** for, and only those.
     *
     * A row that exists is the owning system's opinion — including the opinion
     * that they left this list — and rewriting it is the resurrection the
     * class docblock refuses. It is also what makes the whole push idempotent:
     * after a completed push there is nothing missing, so a retry writes
     * nothing.
     *
     * @param array{id: string, lists: list<string>} $subscriber
     * @param list<string> $lists
     * @return string The matched subscriber's id, unchanged.
     */
    private function join(array $subscriber, array $lists): string
    {
        $missing = array_values(array_diff($lists, $subscriber['lists']));

        if ($missing !== []) {
            $this->subscribers->join($subscriber['id'], $missing);
        }

        return $subscriber['id'];
    }

    /**
     * @param array<string, string> $values
     * @return array<string, string>
     */
    private function newSubscriber(array $values): array
    {
        $subscriber = [];

        foreach (self::COLUMNS as $canonical => $column) {
            if (isset($values[$canonical])) {
                $subscriber[$column] = $values[$canonical];
            }
        }

        return $subscriber;
    }

    /**
     * The configured list ids, however they were stored.
     *
     * `settings` is an opaque bag — `DestinationController::store()` validates
     * nothing in it — so this defends itself here rather than trusting the
     * write path, the same posture `applyTags()` and the lead-magnet type's
     * `setting()` take over the same bag.
     *
     * @return list<string>
     */
    private function configuredLists(PushContext $context): array
    {
        return DestinationRequirements::ids($context->settings[self::LISTS] ?? null);
    }
}
