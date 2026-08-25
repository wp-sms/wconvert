<?php

namespace WConvert\Goal;

use WConvert\Support\ProPresence;
use WConvert\Support\SitePresence;

defined('ABSPATH') || exit;

/**
 * The five v1 [[Goal]]s, resolved against this install.
 *
 * The set is {@see Goal}'s — an enum, closed, with no filter (ADR 0019's
 * fifth refusal). What this adds is the one thing the enum cannot know: which
 * of the three [[Availability]] states each member is in *here*, which is a
 * property of the install rather than of the Goal.
 *
 * **Nothing is filtered out.** The three states name **why** a member is
 * absent; **how** that absence renders is a property of the surface, and the
 * two surfaces render it oppositely — a settings list the merchant went
 * hunting through *explains* the gap, and the goal screen, being the front
 * door of a creation flow, *hides* it (ADR 0026). A registry that dropped
 * `unavailable` members here would have decided that for both.
 *
 * Presence is passed in rather than read here, which is what lets the `locked`
 * card be reachable from a test: `WCONVERT_PRO_LOADED` is a constant and a
 * constant cannot be undefined again.
 *
 * @since 0.1.0
 */
final class GoalRegistry
{
    public function __construct(
        private readonly ProPresence $pro,
        private readonly SitePresence $site,
    ) {
    }

    /**
     * One Goal's Availability on this install.
     *
     * The precedence — `unavailable` beats `locked` — is
     * {@see Availability::of()}'s and not restated here, so a second surface
     * asking the same question cannot get a different answer.
     */
    public function availabilityOf(Goal $goal): Availability
    {
        $requires = $goal->requires();

        return Availability::of(
            $requires === null || $this->site->has($requires),
            $goal->tier()->isSuppliedBy($this->pro)
        );
    }

    /**
     * Whether a merchant may put a NEW Optin under this Goal.
     *
     * Only `ready`. An Optin already holding a Goal keeps it whatever happens
     * to the install afterwards — the Goal is read at report time and never
     * frozen, so a site that loses WooCommerce keeps every number it already
     * counted and they stay correct (ADR 0026). This is about the write, not
     * about the row.
     */
    public function isSettable(Goal $goal): bool
    {
        return $this->availabilityOf($goal) === Availability::Ready;
    }

    /**
     * Every Goal, as the creation flow receives it.
     *
     * `converting_act` and `headline_kind` travel because the surface shows
     * the merchant what they are choosing to be measured on, and both are
     * declarations of the Goal rather than facts about the install. The
     * gallery filters on Goal only, so nothing else about a Goal needs to
     * reach the browser.
     *
     * @return list<array<string, mixed>>
     */
    public function toArray(): array
    {
        return array_map(fn (Goal $goal): array => [
            'id' => $goal->value,
            'label' => $goal->label(),
            'description' => $goal->description(),
            'converting_act' => $goal->convertingAct()->value,
            'headline_kind' => $goal->headlineKind()->value,
            'tier' => $goal->tier()->value,
            'availability' => $this->availabilityOf($goal)->value,
        ], Goal::cases());
    }
}
