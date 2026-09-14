<?php

namespace WConvert\Goal;

use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\SitePresence;

defined('ABSPATH') || exit;

final class GoalRegistry
{
    public function __construct(
        private readonly ProPresence $pro,
        private readonly SitePresence $site,
    ) {
    }

    public function availabilityOf(Goal $goal): Availability
    {
        $requires = $goal->requires();

        return Availability::of(
            $requires === null || $this->site->has($requires),
            $goal->tier()->isSuppliedBy($this->pro)
        );
    }

    public function isSettable(Goal $goal): bool
    {
        return $this->availabilityOf($goal) === Availability::Ready;
    }

    /** @return list<array<string, mixed>> */
    public function toArray(): array
    {
        return array_map(fn (Goal $goal): array => [
            'id' => $goal->value,
            'label' => $goal->label(),
            'description' => $goal->description(),
            'outcome' => $goal->outcome()->toArray(),
            'headline_kind' => $goal->headlineKind()->value,
            'headline_label' => $goal->headlineLabel(),
            'tier' => $goal->tier()->value,
            'availability' => $this->availabilityOf($goal)->value,
        ], Goal::cases());
    }
}
