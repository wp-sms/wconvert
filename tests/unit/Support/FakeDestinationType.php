<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Destination\DestinationType;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Lead\Lead;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

/**
 * A [[Destination]] type that answers whatever a test told it to.
 *
 * It exists so the health rules can be exercised against every kind of
 * {@see PushResult} without a vendor — the distinction ADR 0008 rests on is
 * between *kinds of failure*, and only the type knows which kind a failure is.
 */
final class FakeDestinationType implements DestinationType
{
    /** @var list<PushResult> Answers, taken in order; the last one repeats. */
    public array $answers = [];

    /** @var list<Lead> Every Lead it was handed. */
    public array $pushed = [];

    public function __construct(
        private readonly string $id = 'fake',
        private readonly Tier $tier = Tier::Free,
        private readonly ?SiteDependency $requires = null,
    ) {
    }

    public function id(): string
    {
        return $this->id;
    }

    public function label(): string
    {
        return 'Fake';
    }

    public function icon(): string
    {
        return 'plug';
    }

    public function tier(): Tier
    {
        return $this->tier;
    }

    public function requires(): ?SiteDependency
    {
        return $this->requires;
    }

    public function connectionSchema(): ?array
    {
        return null;
    }

    public function settingsSchema(array $credentials): array
    {
        unset($credentials);

        return [];
    }

    public function testConnection(array $credentials): void
    {
        unset($credentials);
    }

    public function push(Lead $lead, PushContext $context): PushResult
    {
        unset($context);

        $this->pushed[] = $lead;

        return count($this->answers) > 1 ? array_shift($this->answers) : ($this->answers[0] ?? PushResult::success('ref'));
    }

    public function throughput(): int
    {
        return 30;
    }
}
