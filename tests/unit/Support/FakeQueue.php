<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Queue\Queue;

/**
 * A queue that records instead of scheduling.
 *
 * What it records is the whole of what a test needs to see: the hook, the
 * arguments **exactly as they would be stored in Action Scheduler's tables**,
 * and the time a delayed job was asked for. The arguments matter most — the
 * rule that no [[Lead]] data ever reaches them is asserted against this array
 * (ADR 0008).
 */
final class FakeQueue implements Queue
{
    /** @var list<array{hook: string, args: array<string, scalar>, at: int|null}> */
    public array $jobs = [];

    /**
     * @param array<string, scalar> $args
     */
    public function dispatch(string $hook, array $args): void
    {
        $this->jobs[] = ['hook' => $hook, 'args' => $args, 'at' => null];
    }

    /**
     * @param array<string, scalar> $args
     */
    public function schedule(int $timestamp, string $hook, array $args): void
    {
        $this->jobs[] = ['hook' => $hook, 'args' => $args, 'at' => $timestamp];
    }
}
