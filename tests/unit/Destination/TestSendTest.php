<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\CanonicalFields;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushOutcome;
use WConvert\Destination\PushResult;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Tier;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * **A test send never writes a [[Lead]], and it moves no counter.**
 *
 * This is the precondition
 * [#35](https://github.com/navidkashani/wconvert/issues/35) is built on rather
 * than a feature of its own. Four ESP adapters written around a `Lead` argument
 * would all need reworking the day a *Send a test* button arrived, so the
 * signature changes before they exist
 * ([ADR 0031](../../../docs/adr/0031-a-lead-has-exactly-one-origin.md), which
 * is where the reason a test Lead cannot be written is already argued).
 *
 * What is under test is the pair of negatives, because they are what an
 * implementation gets wrong by default: a test that failed looks exactly like a
 * push that failed, so recording it is the natural thing to write, and it would
 * let a merchant fixing an API key mark their own Destination unhealthy four
 * times over.
 */
final class TestSendTest extends TestCase
{
    private FakeOptionStore $options;

    private FakeConnection $db;

    private FakeQueue $queue;

    private FakeDestinationType $type;

    private DestinationStore $destinations;

    private HealthStore $health;

    private string $destinationId;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $this->queue = new FakeQueue();
        $this->type = new FakeDestinationType();

        $this->destinations = new DestinationStore($this->options);
        $this->health = new HealthStore($this->options);

        $this->destinationId = $this->destinations->save(null, 'fake', 'Fake', null, ['tag' => 'welcome'])->id;
    }

    private function dispatcher(?DestinationRegistry $registry = null): PushDispatcher
    {
        return new PushDispatcher(
            $registry ?? (new DestinationRegistry(new FakeProPresence(false), new FakeSitePresence()))
                ->register($this->type),
            $this->destinations,
            new OptinRepository(
                $this->db,
                new PublishedSet($this->options),
                RuleVocabulary::fromManifest(dirname(__DIR__, 3))
            ),
            $this->health,
            $this->queue,
            new ConnectionStore($this->options)
        );
    }

    /**
     * @param array<string, mixed> $values
     */
    private function test(array $values = ['email' => 'merchant@example.com']): PushResult
    {
        return $this->dispatcher()->test($this->destinationId, $values);
    }

    /**
     * The Destination is reached with the merchant's own values, and it is told
     * they are a test.
     */
    public function testItReachesTheDestinationMarkedAsATest(): void
    {
        $result = $this->test(['email' => 'merchant@example.com', 'name' => 'The Merchant']);

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertCount(1, $this->type->pushed);
        self::assertTrue($this->type->pushed[0]->isTest);
        self::assertSame(
            ['email' => 'merchant@example.com', 'name' => 'The Merchant'],
            $this->type->pushed[0]->values
        );
    }

    /**
     * **The whole point.** A [[Lead]] has exactly one origin (ADR 0031), so the
     * table a capture writes to is not touched at all — no `INSERT`, and no
     * read either.
     */
    public function testItWritesNoLeadRow(): void
    {
        $this->test();

        self::assertSame([], $this->db->writes);
        self::assertSame([], $this->db->upserts);
        self::assertSame([], $this->db->statements);
    }

    /** It is answered here and now. Nothing reaches Action Scheduler. */
    public function testItQueuesNothing(): void
    {
        $this->test();

        self::assertSame([], $this->queue->jobs);
    }

    /**
     * A test that landed is not a delivery. Health is where a merchant reads
     * whether their captures are arriving, and a button press is not a capture.
     */
    public function testASuccessfulTestMovesNoHealth(): void
    {
        $this->test();

        self::assertNull($this->health->of($this->destinationId)->lastSuccessAt);
    }

    /**
     * **The one that inverts under a naive implementation.** A merchant
     * pressing *Send a test* four times while pasting an API key must not walk
     * away with a Destination reading four consecutive outages.
     */
    public function testAFailedTestMovesNoHealth(): void
    {
        $this->type->answers = [PushResult::retryable('The vendor said 503.')];

        $result = $this->test();
        $this->test();
        $this->test();

        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertSame('The vendor said 503.', $result->reason);
        self::assertSame(0, $this->health->of($this->destinationId)->consecutiveFailures);
        self::assertNull($this->health->of($this->destinationId)->lastError);
        self::assertSame([], $this->queue->jobs, 'A test is answered once; there is nothing to retry.');
    }

    /**
     * The values go through {@see CanonicalFields} exactly as a Lead's do, so a
     * test cannot exercise a path a capture never takes.
     */
    public function testItDropsAnythingOutsideTheCanonicalFields(): void
    {
        $this->test(['email' => 'merchant@example.com', 'nickname' => 'Bob', 'consent' => 'I agree']);

        self::assertSame(['email' => 'merchant@example.com'], $this->type->pushed[0]->values);
    }

    /**
     * `consent` is reserved and written by nothing (CanonicalFields), and a
     * test send is the one caller that could plausibly have supplied it. The
     * assertion above covers it; this names why it matters — a [[Consent
     * Record]] is wording shown to a person, and nobody was shown anything.
     */
    public function testAnEmptyValueIsDroppedRatherThanSentAsBlank(): void
    {
        $this->test(['email' => 'merchant@example.com', 'phone' => '   ']);

        self::assertSame(['email' => 'merchant@example.com'], $this->type->pushed[0]->values);
    }

    /**
     * No [[Optin]] means no provenance to assert. `optinName` is null, which is
     * the case {@see \WConvert\Destination\PushContext} already documents:
     * writing an empty `source_ref` would claim the push came from somewhere
     * (ADR 0023).
     */
    public function testItCarriesNoOptinNameAndTheDestinationsOwnSettings(): void
    {
        $this->dispatcher()->test($this->destinationId, ['email' => 'merchant@example.com']);

        self::assertNull($this->type->contexts[0]->optinName);
        self::assertSame(['tag' => 'welcome'], $this->type->contexts[0]->settings);
    }

    /** An id naming nothing is terminal: there is nothing to try again against. */
    public function testAnUnknownDestinationIsTerminal(): void
    {
        $result = $this->dispatcher()->test('01NOSUCHDESTINATION00000000', ['email' => 'merchant@example.com']);

        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertFalse($result->retryable);
        self::assertSame([], $this->type->pushed);
    }

    /**
     * A locked or absent type is **skipped**, the same ordinary outcome
     * `dispatch()` gives it — minus the recording, because the merchant is
     * looking at the answer rather than reading it off a health row later.
     */
    public function testATypeThisSiteCannotRunIsSkipped(): void
    {
        $registry = (new DestinationRegistry(new FakeProPresence(false), new FakeSitePresence()))
            ->register(new FakeDestinationType('fake', Tier::Pro));

        $result = $this->dispatcher($registry)->test($this->destinationId, ['email' => 'merchant@example.com']);

        self::assertSame(PushOutcome::Skipped, $result->outcome);
        self::assertSame(0, $this->health->of($this->destinationId)->skippedCaptures);
    }
}
