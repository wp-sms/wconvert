<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Destination\MailPoet\MailPoetSubscribers;
use WConvert\Destination\MailPoet\SubscriberExists;

/**
 * An in-memory MailPoet — **with its unique index on email, and with
 * membership rows that carry a status.**
 *
 * Both of those are the reason this is a fake rather than a stub.
 * `mailpoet_subscribers` is unique on `email`, so a second `addSubscriber()`
 * for one address is a collision that HAPPENS rather than one a test stages —
 * which is what makes the retry assertion mean something. And
 * `mailpoet_subscriber_segment` is a row per (subscriber × list) carrying its
 * own `status`, so a merchant's *"unsubscribe me from Offers"* is a stored
 * opinion that {@see self::join()} would overwrite if it were handed a list
 * that already has a row.
 *
 * **{@see self::join()} is deliberately the dangerous one**: it writes the
 * status of whatever list it is given, exactly as MailPoet's
 * `SubscriberSegmentRepository::createOrUpdate()` does. A fake that quietly
 * skipped rows it already held would make
 * {@see \WConvert\Tests\Unit\Destination\MailPoetPushTest} pass whatever the
 * type did with them, which is the one thing that test exists to pin down.
 *
 * **What it cannot do is change a subscriber's own status**, and neither can
 * the interface — see {@see MailPoetSubscribers}. That is the never-mutate
 * rule held by the SHAPE of the seam; the assertion that the real adapter
 * picks the status-preserving MailPoet call lives in
 * {@see \WConvert\Tests\Unit\Contract\TheFreeCapturePathStaysInProcessTest}
 * and in `bin/verify-destinations.php`, because no fake can see which method
 * another plugin's API was asked for.
 */
final class FakeMailPoetSubscribers implements MailPoetSubscribers
{
    /**
     * The site's lists — id => name.
     *
     * `array-key` rather than `string` on the key, because PHP coerces a
     * numeric-string array key to an int and MailPoet's segment ids are
     * integers. That coercion is the whole reason
     * {@see MailPoetSubscribers::lists()} hands out pairs rather than a map,
     * and it is worth a fixture that reproduces it rather than one that
     * sidesteps it with alphabetic ids MailPoet never mints.
     *
     * @var array<array-key, string>
     */
    public array $lists = ['3' => 'Newsletter', '4' => 'Offers'];

    /** @var array<string, array<string, mixed>> Subscriber rows by id. */
    public array $subscribers = [];

    /** @var array<string, array<array-key, string>> subscriber id => (list id => membership status). */
    public array $memberships = [];

    /** @var list<array{subscriber: array<string, string>, lists: list<string>}> Every add(), in order. */
    public array $added = [];

    /** @var list<array{subscriber: string, lists: list<string>}> Every join(), in order. */
    public array $joined = [];

    /** @var list<string> Failures to raise, one per add/join call, in order. `''` means "no failure". */
    public array $failures = [];

    /**
     * @var array<string, array<string, mixed>> A subscriber that lands the
     *      instant {@see self::add()} is called — another writer arriving
     *      between our read and our write. The only way to stage a collision
     *      on CREATE, since a row seeded up front would simply be matched.
     */
    public array $raceOnAdd = [];

    /**
     * What MailPoet gives a brand-new subscriber.
     *
     * `subscribed` models a site with signup confirmation OFF and
     * `unconfirmed` a site with it on. It is MailPoet's decision either way —
     * WConvert never confirms an [[Optin]] and never asks for one to be
     * skipped (ADR 0016).
     */
    public string $statusForNew = 'subscribed';

    private int $nextId = 1;

    /**
     * Seed a subscriber as MailPoet already holds them.
     *
     * @param array<string, mixed> $row
     * @param array<array-key, string> $memberships list id => membership status
     */
    public function seed(string $id, array $row, array $memberships = []): void
    {
        $this->subscribers[$id] = $row + ['id' => $id];
        $this->memberships[$id] = $memberships;
    }

    public function lists(): array
    {
        $pairs = [];

        foreach ($this->lists as $id => $name) {
            $pairs[] = ['id' => (string) $id, 'name' => $name];
        }

        return $pairs;
    }

    public function add(array $subscriber, array $listIds): string
    {
        $this->raiseNextFailure();

        $this->added[] = ['subscriber' => $subscriber, 'lists' => $listIds];

        foreach ($this->raceOnAdd as $id => $row) {
            $this->subscribers[$id] = $row + ['id' => $id];
            $this->memberships[$id] ??= [];
        }

        $this->raceOnAdd = [];

        // `mailpoet_subscribers` is unique on email.
        if ($this->idOf((string) ($subscriber['email'] ?? '')) !== null) {
            throw new SubscriberExists('This subscriber already exists.');
        }

        $id = 'subscriber-' . $this->nextId++;

        $this->subscribers[$id] = $subscriber + ['id' => $id, 'status' => $this->statusForNew];
        $this->memberships[$id] = [];

        $this->write($id, $listIds);

        return $id;
    }

    public function find(string $email): ?array
    {
        $id = $this->idOf($email);

        if ($id === null) {
            return null;
        }

        // The id and the memberships. NOT the status — the interface has no
        // way to report one, which is what stops a caller branching on it.
        return [
            'id' => $id,
            'lists' => array_map('strval', array_keys($this->memberships[$id] ?? [])),
        ];
    }

    public function join(string $subscriberId, array $listIds): void
    {
        $this->raiseNextFailure();

        $this->joined[] = ['subscriber' => $subscriberId, 'lists' => $listIds];

        // Overwrites, exactly as `createOrUpdate()` does. See the class
        // docblock: it is the caller's job not to hand this a list MailPoet
        // already holds a row for.
        $this->write($subscriberId, $listIds);
    }

    /**
     * @param list<string> $listIds
     */
    private function write(string $subscriberId, array $listIds): void
    {
        foreach ($listIds as $listId) {
            $this->memberships[$subscriberId][$listId] = 'subscribed';
        }
    }

    private function idOf(string $email): ?string
    {
        foreach ($this->subscribers as $id => $subscriber) {
            if (($subscriber['email'] ?? null) === $email) {
                return (string) $id;
            }
        }

        return null;
    }

    private function raiseNextFailure(): void
    {
        if ($this->failures === []) {
            return;
        }

        $failure = array_shift($this->failures);

        if ($failure !== '') {
            throw new \RuntimeException($failure);
        }
    }
}
