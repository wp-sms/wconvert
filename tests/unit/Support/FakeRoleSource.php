<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Targeting\RoleSource;

/**
 * A role source with no WordPress behind it.
 *
 * Two lists rather than one: what a site OFFERS and what a visitor HOLDS are
 * different questions asked by different surfaces, and a stub that conflated
 * them could not express the case that matters — a merchant targeting a role
 * this visitor does not have.
 *
 * It is also what stands in for a membership adapter, which is the whole point
 * of the seam: a test registers two of these and asserts the union, without
 * either one being WordPress.
 */
final class FakeRoleSource implements RoleSource
{
    /**
     * @param array<string, string> $offered
     * @param list<string> $held
     */
    public function __construct(
        private readonly array $offered = [],
        private readonly array $held = [],
    ) {
    }

    /** @return array<string, string> */
    public function offered(): array
    {
        return $this->offered;
    }

    /** @return list<string> */
    public function held(): array
    {
        return $this->held;
    }
}
