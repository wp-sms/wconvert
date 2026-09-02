<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Destination\DestinationType;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushSubject;
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

    /** @var list<PushSubject> Every subject it was handed, test sends included. */
    public array $pushed = [];

    /** @var list<PushContext> The context each push arrived with, in the same order. */
    public array $contexts = [];

    /**
     * What {@see self::connectionSchema()} answers.
     *
     * Null is *"this type has no [[Connection]]"*, which is every free type
     * and the state a *Test connection* button has to say something honest
     * about (#88).
     *
     * @var array<string, mixed>|null
     */
    public ?array $connectionSchema = null;

    /**
     * What {@see self::settingsSchema()} answers.
     *
     * @var array<string, mixed>
     */
    public array $settingsSchema = [];

    /** Raised by {@see self::testConnection()}, so a refused key can be staged. */
    public ?\Throwable $connectionFailure = null;

    /** @var list<array<string, mixed>> Every testConnection(), in order. */
    public array $connectionTests = [];

    /** Raised by {@see self::settingsSchema()} — an ESP's options may come off the wire. */
    public ?\Throwable $schemaFailure = null;

    /** How many times the schema was asked for. */
    public int $schemaReads = 0;

    /** @var list<array<string, mixed>> The credentials each schema read arrived with, in order. */
    public array $schemaCredentials = [];

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
        return $this->connectionSchema;
    }

    public function settingsSchema(array $credentials): array
    {
        $this->schemaReads++;
        $this->schemaCredentials[] = $credentials;

        if ($this->schemaFailure !== null) {
            throw $this->schemaFailure;
        }

        return $this->settingsSchema;
    }

    public function testConnection(array $credentials): void
    {
        $this->connectionTests[] = $credentials;

        if ($this->connectionFailure !== null) {
            throw $this->connectionFailure;
        }
    }

    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $this->pushed[] = $subject;
        $this->contexts[] = $context;

        return count($this->answers) > 1 ? array_shift($this->answers) : ($this->answers[0] ?? PushResult::success('ref'));
    }

    public function throughput(): int
    {
        return 30;
    }
}
