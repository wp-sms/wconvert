<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * How many bytes a design may cost, and how many a page may.
 *
 * ============================================================================
 * TWO NUMBERS, ONE PLACE, BECAUSE THREE THINGS NOW ARGUE OVER THEM.
 * ============================================================================
 * ADR 0010 set a **≤2KB gzipped per-page payload** and
 * {@see \WConvert\Tests\Unit\Frontend\PayloadBudgetTest} has held it since —
 * ten snapshots of one design, measured together, because they compress against
 * each other on a real page.
 *
 * That instrument answers *"is the page over budget"* and it cannot answer
 * *"which design did it"*. The library is heading for reference-class designs
 * carrying three to four times the copy of the ones the fixture was built from,
 * so the per-page figure would go from comfortable to over in one commit and
 * the failure would name the page rather than the design. So there is a second
 * number: a **per-design cap**, checked at authoring time by
 * {@see \WConvert\Tests\Unit\Template\LibraryLintTest}, which is where a
 * merchant's page render is not.
 *
 * **The admin's payload meter reads the same number**, over the wire, the way
 * `InspectorEnqueue::PARAM` does — a meter drawn against a figure written a
 * second time in TypeScript is a meter that goes green on the day the cap moves
 * ({@see \WConvert\Admin\AdminMenu::settings()}).
 *
 * ============================================================================
 * THE PER-PAGE BUDGET IS NOT RAISED, AND THAT WAS A CORRECTION. TWICE.
 * ============================================================================
 * An early reading of this work claimed ten rich designs came to ~2,320 B
 * against 2,048 and that the budget therefore had to grow. The fixture actually
 * measured **1,308 B — 36% of headroom**. The budget is not breached, so the
 * instrument changes and the number does not (ADR 0062).
 *
 * It bound for real when six reference designs were ported: 2,192–2,293 B at
 * ten, and 2,087–2,108 B with every SVG and gradient stripped out of them — so
 * shrinking the designs bought nothing, because on that page the art dedupes
 * across the ten copies and the diverged copy does not. The reading held
 * anyway, and for the same reason: **ten Optins on one page is not a page.** At
 * most one overlay wins a page view. {@see \WConvert\Tests\Unit\Frontend\PayloadBudgetTest}
 * measures five now, the costliest shipped design is 1,854 B there, and one
 * Optin — what a visitor actually pays — is 1,482 B.
 *
 * @since 0.1.0
 */
final class DesignBudget
{
    /**
     * The whole page's payload, gzipped, however many Optins are on it.
     *
     * ADR 0010's number, unchanged, and the one a visitor actually pays.
     */
    public const PER_PAGE = 2048;

    /**
     * One design's own snapshot — tree plus tokens — gzipped, on its own.
     *
     * **Half the page**, and that is the whole of the derivation: a design that
     * costs more than `PER_PAGE / 2` measured ALONE is one design eating a page
     * two Optins are meant to share. It is a generous line rather than a tight
     * one — the richest design the library ships measures 677 B, so there is
     * more than half again in hand — because this is not a target and a cap
     * that argues with ordinary authoring is a cap people route around. The
     * richest is 1,004 B since the reference designs landed, so the hand is
     * mostly spent — and that is the cap doing its job rather than a problem.
     *
     * What it actually catches is the one realistic failure: an embedded raster
     * `bg-image` or `image.src`, which is a step change rather than a drift and
     * which the per-PAGE test would only report two commits later, naming a page
     * rather than the design.
     *
     * Measured alone rather than beside its siblings, which is harsher than
     * reality: on a page the snapshots compress against each other, so a design
     * that fits on its own fits beside them.
     *
     * **It does not follow that a design under this cap fits the page**, and
     * that is worth saying because `PER_PAGE / 2` reads as though it does. What
     * a page costs is dominated by the copy the merchant wrote into each Optin,
     * which this never sees — the snapshot has its text stripped. The two are
     * separate guards on separate quantities; passing here is not passing there.
     *
     * A design over this is not refused; nothing at runtime reads this. It fails
     * the library lint, at authoring time, which is the only moment anyone can
     * do anything about it.
     */
    public const PER_DESIGN = self::PER_PAGE / 2;
}
