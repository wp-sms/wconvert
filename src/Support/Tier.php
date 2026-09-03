<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Which install supplies a registry member — free, or one of [[Pro]]'s three.
 *
 * **A type, not a list.** ADR 0015 refuses a cross-cutting vocabulary of
 * premium capabilities: "each registry declares `tier` locally on members it
 * already enumerates, so the premium split adds zero new lists". This is the
 * spelling those declarations use, shared so the rule manifest, the [[Goal]]
 * registry and the design library cannot disagree about what "pro" is spelled
 * like. It enumerates nothing about which members are premium.
 *
 * Free ships every case, and that is deliberate: free's PHP is what renders a
 * `locked` card and what strips an unentitled rule at enqueue, and it can only
 * do either for a tier it can name (ADR 0005).
 *
 * =============================================================================
 * IT IS A SCALE RATHER THAN A BOOLEAN, FROM DAY ONE, AND ONE TIER IS SOLD.
 * =============================================================================
 * This was two cases and a `bool`, which had nowhere to put a third tier and
 * nowhere to get a three-valued answer from. The cases and the rank below are
 * the whole of the change, and they are here BEFORE the product needs them
 * because after free 0.1.0 is on wp.org the same change is every screen, every
 * upsell card and every saved record (ADR 0056).
 *
 * All three paid tiers display as **"Pro"** at launch — the display name is
 * `tiers.json`'s, never this enum's — so splitting the range later is an edit
 * to that file rather than a code change and a data migration.
 *
 * ## The rank is here, and the display names and module sets are in the file
 *
 * A deliberate split, and the reason is ADR 0015's own cautionary case: WSMS's
 * shipped elite ZIP is missing the `tiers.json` its `TierGate` reads, benign
 * only because every lookup fails open — "and a ladder that fails open is not
 * a ladder". {@see self::includes()} is total and reads no file, so the
 * ordering cannot fail open however badly a build goes wrong. What the file
 * carries is what only a file can: the words a merchant reads, and which
 * modules a tier ships. {@see \WConvert\Tests\Unit\Support\TierManifestTest}
 * is what stops the two spellings of the ladder drifting.
 *
 * @since 0.1.0
 */
enum Tier: string
{
    case Free = 'free';

    case Basic = 'basic';

    case Pro = 'pro';

    case Elite = 'elite';

    /**
     * The ladder, ascending. Higher supplies everything lower does.
     *
     * Spelled once, here, and read by {@see self::rank()} and by the manifest
     * parity test — so `tiers.json` listing its tiers in another order is a
     * red build rather than a silently different ladder.
     *
     * @return list<self>
     */
    public static function ladder(): array
    {
        return [self::Free, self::Basic, self::Pro, self::Elite];
    }

    /**
     * Every paid tier, ascending — the ones a build can actually be.
     *
     * Free is not one: a free install is not the bottom rung of Pro, it is the
     * whole product minus features it never carried (CONTEXT.md, Pro).
     *
     * @return list<self>
     */
    public static function paid(): array
    {
        return [self::Basic, self::Pro, self::Elite];
    }

    /** Where this tier sits on the ladder. Higher is more. */
    public function rank(): int
    {
        return (int) array_search($this, self::ladder(), true);
    }

    /**
     * Whether an install AT this tier supplies a member declared at `$other`.
     *
     * The one piece of arithmetic the ladder adds, and the reason `Tier` stops
     * being a boolean: with two cases "does this install have it" was the same
     * question as "is Pro loaded", and with four it is a comparison. A Pro
     * install supplies everything Basic does; a Basic install supplies nothing
     * Elite declares.
     *
     * **Free is included by every tier**, which is what makes a paid install
     * the whole product rather than a different one.
     */
    public function includes(self $other): bool
    {
        return $this->rank() >= $other->rank();
    }

    /**
     * Whether this install supplies the tier this member is declared at.
     *
     * Reads the INSTALLED tier rather than a boolean — {@see ProPresence} is
     * "which tier is on disk", inferred from the modules that shipped, and a
     * free install answers {@see self::Free}. Free is always supplied, so a
     * member free declares needs nothing looked up at all.
     */
    public function isSuppliedBy(ProPresence $pro): bool
    {
        return $this === self::Free || $pro->installedTier()->includes($this);
    }
}
