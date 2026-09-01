<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadRepository;
use WConvert\Lead\Submission;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Availability;
use WConvert\Support\SiteDependency;
use WConvert\Support\Ulid;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\FakeWsmsContacts;

/**
 * **[[Standalone]] is a fully working install** — capture, the [[Lead]] log
 * and CSV export all work with no WSMS anywhere.
 *
 * WSMS is never a runtime requirement of the capture path (CONTEXT.md,
 * Standalone), and this is where that is held rather than assumed. The failure
 * it guards against is not subtle — it is a fatal on a site that never had
 * WSMS installed — but it is invisible to every other test in this suite,
 * because the rest of them pass a fake in.
 */
final class StandaloneTest extends TestCase
{
    private FakeConnection $db;

    private FakeOptionStore $options;

    private FakeQueue $queue;

    private string $optinId;

    private string $destinationId;

    protected function setUp(): void
    {
        $this->db = new FakeConnection();
        $this->options = new FakeOptionStore();
        $this->queue = new FakeQueue();

        $this->optinId = Ulid::generate();

        $this->destinationId = (new DestinationStore($this->options))
            ->save(null, WsmsDestinationType::ID, 'WP SMS', null, [])->id;

        $this->db->rows[$this->optinId] = [
            'id' => $this->optinId,
            'name' => 'Guide download',
            'goal' => 'grow_list',
            'config' => '{}',
            'published_config' => (string) json_encode(['destinations' => [$this->destinationId]]),
            'published_at' => '2026-08-25 09:00:00',
            'deleted_at' => null,
        ];
    }

    /**
     * The site has no WSMS, so the WSMS [[Destination]] type is
     * **`unavailable`** — not `locked`. A missing plugin is not something we
     * can sell, and collapsing the two would offer a merchant a Pro licence
     * for a feature Pro would not give them either (ADR 0026).
     */
    public function testWithoutWsmsTheTypeIsUnavailableRatherThanLocked(): void
    {
        $registry = (new DestinationRegistry(new FakeProPresence(false), new FakeSitePresence()))
            ->register(new WsmsDestinationType(new FakeWsmsContacts()));

        self::assertSame(Availability::Unavailable, $registry->availabilityOf(WsmsDestinationType::ID));

        $withWsms = (new DestinationRegistry(
            new FakeProPresence(false),
            new FakeSitePresence([SiteDependency::Wsms])
        ))->register(new WsmsDestinationType(new FakeWsmsContacts()));

        self::assertSame(Availability::Ready, $withWsms->availabilityOf(WsmsDestinationType::ID));
    }

    /**
     * **The capture still happens, and nothing is queued.**
     *
     * A Destination whose type is not `ready` is skipped and never enqueued: an
     * Action Scheduler job whose handler cannot succeed retries against
     * nothing forever, silently. The Optin keeps showing and keeps capturing,
     * because losing captures because a dependency went away would be the one
     * genuinely unrecoverable failure available here (#4).
     */
    public function testCaptureStillLandsALeadAndQueuesNothing(): void
    {
        $registry = (new DestinationRegistry(new FakeProPresence(false), new FakeSitePresence()))
            ->register(new WsmsDestinationType(new FakeWsmsContacts()));

        $optins = new OptinRepository(
            $this->db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3))
        );

        $health = new HealthStore($this->options);

        (new PushDispatcher(
            $registry,
            new DestinationStore($this->options),
            $optins,
            $health,
            $this->queue,
            new ConnectionStore($this->options)
        ))->hooks();

        $lead = (new LeadCapture(new LeadRepository($this->db)))->record(
            $this->optinId,
            new Submission('sarah@example.com', null, ['name' => 'Sarah'])
        );

        self::assertNotSame('', $lead->id, 'The Lead landed.');
        self::assertSame('sarah@example.com', $lead->email);
        self::assertSame([], $this->queue->jobs, 'Nothing is enqueued for a Destination that cannot run.');

        // **Skipped AND RECORDED.** Without this the drop is completely
        // silent: the Optin keeps converting, the Leads keep landing, and
        // nothing anywhere says the pushes stopped — which is the exact
        // support case Destination health exists for (#4).
        $skipped = $health->of($this->destinationId);

        self::assertSame(1, $skipped->skippedCaptures);
        self::assertNotNull($skipped->lastSkippedAt);

        // And it is NOT an outage. Nothing was attempted, so counting it as
        // one would be a lie — and it is the same inversion ADR 0008 draws
        // between a terminal per-Lead failure and a vendor being down.
        self::assertSame(0, $skipped->consecutiveFailures);
        self::assertNull($skipped->lastError);

        remove_all_actions(LeadCapture::CAPTURED);
    }

    /**
     * The [[Lead]] log and the CSV export, on the same install.
     */
    public function testTheLogAndTheCsvExportStillWork(): void
    {
        $leadId = Ulid::generate();
        $this->db->rows[$leadId] = [
            'id' => $leadId,
            'optin_id' => $this->optinId,
            'email' => 'sarah@example.com',
            'phone' => null,
            'fields' => '{"name":"Sarah"}',
            'created_at' => '2026-08-25 10:00:00',
        ];

        $leads = new LeadRepository($this->db);

        $log = (new LeadLog($leads))->read(null, false, 10);

        // Contains rather than "is first": the fake answers a read from every
        // row it holds, and this one holds an Optin as well as a Lead.
        self::assertContains('sarah@example.com', array_column($log['leads'], 'email'));

        $csv = new LeadCsv(TemplateVocabulary::fromManifest(dirname(__DIR__, 3)));
        self::assertContains('email', $csv->columns());

        $handle = fopen('php://memory', 'r+');
        self::assertNotFalse($handle);

        $csv->writeHeader($handle);
        $csv->writeRows(
            $handle,
            array_values(array_filter($leads->page(null, 10), static fn ($lead): bool => $lead->email !== null)),
            [$this->optinId => 'Guide download']
        );
        rewind($handle);

        $written = (string) stream_get_contents($handle);
        fclose($handle);

        self::assertStringContainsString('sarah@example.com', $written);
        self::assertStringContainsString('Guide download', $written);
    }
}
