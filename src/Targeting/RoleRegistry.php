<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * Every {@see RoleSource} this install has, asked as one.
 *
 * ============================================================================
 * A REGISTRY RATHER THAN AN INTERFACE WITH ONE IMPLEMENTATION.
 * ============================================================================
 * A seam you can only REPLACE is not a seam a membership plugin can use: it
 * would have to decorate {@see WpRoleSource} and hope nothing else had already
 * done so. This is the shape {@see \WConvert\Rules\SuppliedRules} and the
 * Destination registry already have — free fills it with what free supplies,
 * and anything else adds to it — which is what makes *"no core change is
 * needed to add one"* true rather than aspirational.
 *
 * **The union is flat and the slugs share one namespace.** Two sources
 * offering the same slug are one choice on the merchant's screen, and the
 * first source to name it wins the word. That is a real collision and it is
 * cheaper than a compound key that every stored rule would have to carry: an
 * adapter prefixes its own levels ({@see RoleSource}).
 *
 * @since 0.1.0
 */
final class RoleRegistry
{
    /** @var list<RoleSource> */
    private array $sources = [];

    public function add(RoleSource ...$sources): self
    {
        foreach ($sources as $source) {
            $this->sources[] = $source;
        }

        return $this;
    }

    /**
     * Everything a merchant may choose, as slug => the site's own word for it.
     *
     * @return array<string, string>
     */
    public function offered(): array
    {
        $offered = [];

        foreach ($this->sources as $source) {
            // `+` rather than `array_merge`, so the FIRST source to offer a
            // slug keeps its word for it. Which is arbitrary between two
            // adapters and is not arbitrary between an adapter and WordPress:
            // free registers `WpRoleSource` at boot, so `subscriber` reads as
            // WordPress's role however many plugins later claim the word.
            $offered += $source->offered();
        }

        return $offered;
    }

    /**
     * What the CURRENT visitor holds, across every source.
     *
     * @return list<string>
     */
    public function held(): array
    {
        $held = [];

        foreach ($this->sources as $source) {
            foreach ($source->held() as $role) {
                $held[] = $role;
            }
        }

        return array_values(array_unique($held));
    }
}
