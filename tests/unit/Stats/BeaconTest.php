<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\Beacon;
use WConvert\Stats\StatKind;
use WConvert\Support\Ulid;

/**
 * What the beacon is willing to count, against bodies somebody made up.
 *
 * The endpoint is public and unauthenticated by necessity — a nonce baked into
 * a page the full-page cache serves byte-identically to everyone authenticates
 * nothing (ADR 0004) — so a body somebody made up is the only kind this ever
 * receives. Every assertion here is about a body that is wrong in a specific
 * way, and about it costing nothing.
 */
#[CoversClass(Beacon::class)]
final class BeaconTest extends TestCase
{
    private const OPTIN = '01JQ0000000000000000000001';

    private const OTHER = '01JQ0000000000000000000002';

    /**
     * @param list<array<string, mixed>> $events
     * @return array<string, mixed>
     */
    private static function body(array $events): array
    {
        return ['events' => $events];
    }

    public function testItReadsTheThreeActsABrowserCanReport(): void
    {
        $events = Beacon::eventsIn(self::body([
            ['optin_id' => self::OPTIN, 'kind' => 'impression'],
            ['optin_id' => self::OPTIN, 'kind' => 'conversion'],
            ['optin_id' => self::OPTIN, 'kind' => 'dismiss'],
        ]));

        $this->assertSame(
            [StatKind::Impression, StatKind::Conversion, StatKind::Dismiss],
            array_map(static fn ($event) => $event->kind, $events)
        );
        $this->assertSame(self::OPTIN, $events[0]->optinId);
    }

    /**
     * **The shape check is `Ulid::isOne()` and not a fourth copy of the
     * pattern.**
     *
     * Three callers had three copies of "this is a ULID" before that method
     * existed — two route constraints and the export's query-string filter —
     * and a copy that drifts from the alphabet the generator mints is a
     * rejection of legitimate ids or an acceptance of values that are not ones.
     * `I`, `L`, `O` and `U` are not in Crockford base32 precisely so a
     * transcribed id cannot be misread.
     */
    public function testAnOptinIdThatIsNotAUlidIsNotAnEvent(): void
    {
        foreach (['', 'not-a-ulid', 'IIIIIIIIIIIIIIIIIIIIIIIIII', str_repeat('0', 25), str_repeat('0', 27)] as $bad) {
            $this->assertSame(
                [],
                Beacon::eventsIn(self::body([['optin_id' => $bad, 'kind' => 'impression']])),
                sprintf('"%s" is not a ULID', $bad)
            );
        }

        $this->assertCount(
            1,
            Beacon::eventsIn(self::body([['optin_id' => Ulid::generate(), 'kind' => 'impression']])),
            'and a real one still is'
        );
    }

    public function testAnUnknownKindIsDropped(): void
    {
        $this->assertSame([], Beacon::eventsIn(self::body([['optin_id' => self::OPTIN, 'kind' => 'scrolled_past']])));
    }

    /**
     * A browser cannot assert a delivery it never saw (ADR 0020).
     */
    public function testADeliveryCannotArriveOnTheBeacon(): void
    {
        $this->assertSame(
            [],
            Beacon::eventsIn(self::body([['optin_id' => self::OPTIN, 'kind' => 'lead_magnet_delivered']]))
        );
    }

    /**
     * One bad entry does not lose the good ones.
     *
     * This arrives through `navigator.sendBeacon` during `pagehide`: there is
     * nobody on the page to see a refusal and nothing that could retry, so
     * refusing the whole flush over one malformed row would silently drop acts
     * that really happened.
     */
    public function testAMalformedEntryIsSkippedRatherThanFatalToTheBatch(): void
    {
        $events = Beacon::eventsIn(self::body([
            ['optin_id' => self::OPTIN, 'kind' => 'impression'],
            ['kind' => 'conversion'],
            ['optin_id' => self::OTHER],
            ['optin_id' => self::OTHER, 'kind' => 'dismiss'],
        ]));

        $this->assertCount(2, $events);
        $this->assertSame([self::OPTIN, self::OTHER], array_map(static fn ($e) => $e->optinId, $events));
    }

    /**
     * **De-duplicated within the request**, because one page view produces one
     * of each: the presenter's observer disconnects after the first
     * intersection, and the Conversion and the Dismissal are each one act. Two
     * of the same in one batch is a client that is broken or lying.
     */
    public function testTheSameActTwiceInOneBatchIsCountedOnce(): void
    {
        $events = Beacon::eventsIn(self::body([
            ['optin_id' => self::OPTIN, 'kind' => 'impression'],
            ['optin_id' => self::OPTIN, 'kind' => 'impression'],
            ['optin_id' => self::OPTIN, 'kind' => 'dismiss'],
        ]));

        $this->assertCount(2, $events);
    }

    /** Two Optins on one page are two acts, not a duplicate. */
    public function testTheSameKindForTwoOptinsIsTwoEvents(): void
    {
        $events = Beacon::eventsIn(self::body([
            ['optin_id' => self::OPTIN, 'kind' => 'impression'],
            ['optin_id' => self::OTHER, 'kind' => 'impression'],
        ]));

        $this->assertCount(2, $events);
    }

    /**
     * The excess is dropped rather than the request refused: a batch that lost
     * its tail has still told the truth about its head.
     */
    public function testABatchIsBounded(): void
    {
        // A fresh id per entry, so de-duplication is not what caps it.
        $events = array_map(
            static fn (): array => ['optin_id' => Ulid::generate(), 'kind' => 'impression'],
            array_fill(0, Beacon::MAX_EVENTS + 10, null)
        );

        $this->assertCount(Beacon::MAX_EVENTS, Beacon::eventsIn(self::body($events)));
    }

    /**
     * **The count is never the client's to choose.** A `count` in the body is
     * read by nothing: the statement increments by exactly one, so a client
     * that sent a number would be sending it to a field that does not exist.
     */
    public function testAClientCannotSendACount(): void
    {
        $events = Beacon::eventsIn(self::body([
            ['optin_id' => self::OPTIN, 'kind' => 'conversion', 'count' => 5000],
        ]));

        $this->assertCount(1, $events);
        $this->assertSame(['optinId', 'kind', 'scope'], array_keys(get_object_vars($events[0])));
    }

    /**
     * Bodies that are not bodies. Every one of these is a real thing a public
     * endpoint receives, and none of them is a reason to fail.
     *
     * @param mixed $body
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('rubbish')]
    public function testABodyThatIsNotABatchIsNoEvents($body): void
    {
        $this->assertSame([], Beacon::eventsIn($body));
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function rubbish(): array
    {
        return [
            'null' => [null],
            'a string' => ['events'],
            'a number' => [7],
            'an empty array' => [[]],
            'events as a string' => [['events' => 'impression']],
            'events as a scalar' => [['events' => 1]],
            'an event that is a string' => [['events' => ['impression']]],
            'an event that is null' => [['events' => [null]]],
        ];
    }
}
