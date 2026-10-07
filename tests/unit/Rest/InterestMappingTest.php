<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\{BulkRePush, ConnectionStore, DeliveryFailures, Destination, DestinationRegistry, DestinationRequirements, DestinationStore, DestinationType, HealthStore, PushContext, PushDispatcher, PushJob, PushResult, PushSubject, PushWorker};
use WConvert\Lead\LeadRepository;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\{OptinRepository, PublishedSet};
use WConvert\Rest\DestinationController;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\{SiteDependency, Tier};
use WConvert\Tests\Unit\Support\{FakeConnection, FakeOptionStore, FakeProPresence, FakeQueue, FakeSitePresence};

final class InterestMappingTest extends TestCase
{
    private DestinationController $controller;
    private PushWorker $worker;
    private InterestMappingDestination $type;
    private Destination $destination;
    private FakeConnection $db;

    protected function setUp(): void
    {
        $options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $queue = new FakeQueue();
        $this->type = new InterestMappingDestination();
        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))->register($this->type);
        $destinations = new DestinationStore($options);
        $connections = new ConnectionStore($options);
        $health = new HealthStore($options);
        $failures = new DeliveryFailures($options);
        $optins = new OptinRepository($this->db, new PublishedSet($options), RuleVocabulary::fromManifest(dirname(__DIR__, 3)), new MilestoneStore($options));
        $leads = new LeadRepository($this->db);
        $this->destination = $destinations->save(null, $this->type->id(), 'Interests', null, []);
        $this->controller = new DestinationController($registry, $destinations, $connections, $health, $failures,
            new BulkRePush($registry, $destinations, $optins, $leads, $health, $queue),
            new PushDispatcher($registry, $destinations, $optins, $health, $queue, $connections));
        $this->worker = new PushWorker($registry, $destinations, $connections, $leads, $optins, $health, $failures, $queue,
            new \WConvert\Destination\LeadMagnet\DeliveryCount($optins, new \WConvert\Stats\StatsRepository($this->db)));
    }

    /** @param array<string, string> $mapping
     * @param array<string, mixed> $sample
     */
    private function request(array $mapping, array $sample): \WP_REST_Request
    {
        $request = new \WP_REST_Request('POST');
        foreach (['id' => $this->destination->id, 'email' => 'owner@example.com', 'mapping' => $mapping, 'sample' => $sample] as $key => $value) $request->set_param($key, $value);
        return $request;
    }

    public function testPreviewAndExplicitTestUseTheSameSelectedInterestsWithoutSendingFalse(): void
    {
        $request = $this->request(['choice:n2:running' => 'running', 'choice:n2:hiking' => 'hiking'], ['choice:n2:running' => true, 'choice:n2:hiking' => false]);
        $preview = $this->controller->draftPreview($request);
        self::assertInstanceOf(\WP_REST_Response::class, $preview);
        self::assertSame(['email' => 'owner@example.com', 'mapped' => ['running' => true]], $preview->get_data());
        self::assertSame([], $this->type->pushed);
        self::assertInstanceOf(\WP_REST_Response::class, $this->controller->draftTest($request));
        self::assertSame(['running' => true], $this->type->pushed[0]->mapped);
        self::assertTrue($this->type->pushed[0]->isTest);
        self::assertSame([], $this->db->rows);
    }

    public function testMismatchedTypesAndDuplicateTargetsAreRejectedBeforeSending(): void
    {
        $cases = [
            [['choice:n2:running' => 'notes'], ['choice:n2:running' => true]],
            [['n2' => 'running'], ['n2' => 'Running']],
            [['choice:n2:running' => 'running'], ['choice:n2:running' => 'true']],
            [['choice:n2:running' => 'running', 'choice:n2:hiking' => 'running'], ['choice:n2:running' => false, 'choice:n2:hiking' => true]],
        ];
        foreach ($cases as [$mapping, $sample]) self::assertInstanceOf(\WP_Error::class, $this->controller->draftTest($this->request($mapping, $sample)));
        self::assertSame([], $this->type->pushed);
    }

    public function testQueuedInterestIsRefusedIfTheProviderFieldBecomesText(): void
    {
        $id = '01M48FXR8T45CTFF0D4KFJZ8F1';
        $this->db->rows[$id] = ['id' => $id, 'optin_id' => 'campaign', 'email' => 'owner@example.com', 'phone' => null, 'created_at' => '2026-10-06 12:00:00',
            'fields' => json_encode(['answers' => [], 'capture' => ['submissions' => ['primary' => [
                'values' => ['email' => 'owner@example.com'],
                'question_answers' => [['id' => 'n2', 'type' => 'multi', 'values' => ['running'], 'labels' => ['Running']]],
                'field_mappings' => [$this->destination->id => ['choice:n2:running' => 'running']],
            ]]]], JSON_THROW_ON_ERROR)];
        $this->worker->run((new PushJob($id, $this->destination->id, 1, 'primary'))->toArgs());
        self::assertCount(1, $this->type->pushed);
        self::assertSame(['running' => true], $this->type->pushed[0]->mapped);
        $this->type->fields = [['value' => 'running', 'label' => 'Now text']];
        $this->worker->run((new PushJob($id, $this->destination->id, 1, 'primary'))->toArgs());
        self::assertCount(1, $this->type->pushed);
    }
}

/** Provider with explicit text and boolean metadata; no remote side effects. */
final class InterestMappingDestination implements DestinationType
{
    /** @var list<PushSubject> */
    public array $pushed = [];
    /** @var list<array{value: string, label: string, type?: 'boolean'}> */
    public array $fields = [['value' => 'notes', 'label' => 'Notes'], ['value' => 'running', 'label' => 'Running', 'type' => 'boolean'], ['value' => 'hiking', 'label' => 'Hiking', 'type' => 'boolean']];
    public function id(): string { return 'interest_test'; }
    public function label(): string { return 'Interest test'; }
    public function icon(): string { return 'mail'; }
    public function tier(): Tier { return Tier::Free; }
    public function requires(): ?SiteDependency { return null; }
    public function throughput(): int { return 30; }
    public function requirements(): DestinationRequirements { return new DestinationRequirements(['email']); }
    public function connectionSchema(): ?array { return null; }
    public function settingsSchema(array $credentials): array { return []; }
    public function testConnection(array $credentials): void {}
    /** @param array<string, mixed> $credentials
     * @param array<string, mixed> $settings
     * @return list<array{value: string, label: string, type?: 'boolean'}>
     */
    public function mappingFields(array $credentials, array $settings): array { return $this->fields; }
    public function push(PushSubject $subject, PushContext $context): PushResult { $this->pushed[] = $subject; return PushResult::success(); }
}
