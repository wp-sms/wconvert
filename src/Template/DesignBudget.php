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
 * THE PER-PAGE BUDGET IS NOT RAISED, AND THAT WAS A CORRECTION.
 * ============================================================================
 * An early reading of this work claimed ten rich designs came to ~2,320 B
 * against 2,048 and that the budget therefore had to grow. The fixture actually
 * measures **1,308 B — 36% of headroom**. The budget is not breached, so the
 * instrument changes and the number does not (ADR 0062).
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
     * **Derived rather than chosen.** The page budget is 2,048 B for everything
     * on it; a page carrying two Optins is ordinary and one carrying three is
     * not rare. A design gzipped ALONE compresses far worse than the same design
     * beside nine near-identical siblings, so this is deliberately not
     * `PER_PAGE / 3` — it is the size at which one design measured in isolation
     * is still comfortably a third of a page once the compressor has the rest of
     * the page to work with.
     *
     * A design over this is not refused; nothing at runtime reads this. It fails
     * the library lint, at authoring time, which is the only moment anyone can
     * do anything about it.
     */
    public const PER_DESIGN = 1536;
}
