<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * What one bulk re-push queued, said out loud.
 *
 * `capped` exists so a truncated replay can never read as a complete one. A
 * recovery that silently stopped at ten thousand Leads and reported success is
 * the worst outcome available here: the operator believes the window is closed
 * and never looks again (ADR 0008).
 *
 * @since 0.1.0
 */
final class RePushReport
{
    public function __construct(
        public readonly int $jobs,
        public readonly bool $capped,
        public readonly ?string $since,
        public readonly int $needsReview = 0,
    ) {
    }

    /**
     * @return array{jobs: int, capped: bool, since: string|null}
     */
    public function toArray(): array
    {
        return ['jobs' => $this->jobs, 'capped' => $this->capped, 'since' => $this->since, 'needs_review' => $this->needsReview];
    }
}
