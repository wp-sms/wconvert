<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Which install supplies a registry member — free, or [[Pro]].
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
 * TWO CASES, BECAUSE THE PRODUCT HAS TWO.
 * =============================================================================
 * This was a four-rung ladder — free, basic, pro, elite — built ahead of a
 * split the product never made (ADR 0056). One Pro is sold, it carries every
 * feature, and the Nexus plans differ only in how many sites they cover, so a
 * plan is not a tier and the rungs between free and Pro are gone (ADR 0146).
 *
 * It is still an enum rather than a `bool`, because every registry member
 * already declares a tier slug and {@see self::includes()} is the one sentence
 * they all answer through. The display name is `tiers.json`'s, never this
 * enum's.
 *
 * {@see self::includes()} is total and reads no file, so it cannot fail open
 * however badly a build goes wrong — ADR 0015's complaint about WSMS's
 * `TierGate`, whose every lookup does.
 *
 * @since 0.1.0
 */
enum Tier: string
{
    case Free = 'free';

    case Pro = 'pro';

    /**
     * Free, then Pro. Read by {@see self::rank()} and by the manifest parity
     * test.
     *
     * @return list<self>
     */
    public static function ladder(): array
    {
        return [self::Free, self::Pro];
    }

    /**
     * Every paid tier — the ones a Pro build can be. There is one.
     *
     * Free is not one: a free install is not the bottom rung of Pro, it is the
     * whole product minus features it never carried (CONTEXT.md, Pro).
     *
     * @return list<self>
     */
    public static function paid(): array
    {
        return [self::Pro];
    }

    /** Where this tier sits on the ladder. Higher is more. */
    public function rank(): int
    {
        return (int) array_search($this, self::ladder(), true);
    }

    /**
     * Whether an install AT this tier supplies a member declared at `$other`.
     *
     * **Free is included by every tier**, which is what makes a Pro install
     * the whole product rather than a different one.
     */
    public function includes(self $other): bool
    {
        return $this->rank() >= $other->rank();
    }

    /**
     * Whether this install supplies the tier this member is declared at.
     *
     * Free is always supplied, so a member free declares needs nothing looked
     * up at all.
     */
    public function isSuppliedBy(ProPresence $pro): bool
    {
        return $this === self::Free || $pro->installedTier()->includes($this);
    }
}
