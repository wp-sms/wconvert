<?php

namespace WConvert\Tests\Unit\Pro\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Template\ProTemplates;
use WConvert\Template\BundledTemplates;
use WConvert\Template\LockedTemplates;
use WConvert\Template\TemplateFacets;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * Pro's designs, and the upsell they are supposed to make disappear.
 *
 * ============================================================================
 * "A PAYING CUSTOMER IS NEVER SHOWN AN ADVERTISEMENT FOR WHAT THEY BOUGHT."
 * ============================================================================
 * That is ADR 0026's rule and `LockedTemplates`'s docblock asserted it in
 * prose: *"A Pro install sees none of this, and not because of a check here …
 * Pro registers the real trees through the same `TemplateSource` seam, so a
 * stub whose id a real entry already holds is dropped."*
 *
 * **The premise was false.** Nothing registered a `TemplateSource` at all, so
 * `TemplateLibrary::locked()`'s `array_diff_key` dropped nothing and every Pro
 * install showed a **Pro badge** on the six bar and slide-in cards it had
 * already paid for. A docblock cannot fail; this can.
 *
 * ============================================================================
 * IT COMPOSES THE SAME THREE SOURCES `ProServiceProvider` DOES, IN ORDER.
 * ============================================================================
 * Order is the mechanism rather than a detail: `LockedTemplates` last, so a
 * stub meets an id the real design already holds. Reading the container instead
 * would need WordPress; the value under test is the composition, which is three
 * arguments in one line.
 */
#[CoversClass(ProTemplates::class)]
final class ProLibraryTest extends TestCase
{
    private const FREE_DIR = __DIR__ . '/../../../..';
    private const PRO_DIR = self::FREE_DIR . '/pro';

    private function library(): TemplateLibrary
    {
        return TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR),
            new ProTemplates(self::PRO_DIR),
            new LockedTemplates(self::FREE_DIR),
        );
    }

    /**
     * The whole point of the ticket, asserted rather than claimed: on Pro, no
     * `floating_bar` and no `slide_in` design is still an advertisement.
     */
    public function testAProInstallIsShownNoUpsellForABarOrASlideIn(): void
    {
        $upsells = array_filter(
            $this->library()->locked(),
            static fn (array $stub): bool => in_array($stub['display_type'], ['floating_bar', 'slide_in'], true)
        );

        $this->assertSame([], array_keys($upsells));
    }

    /**
     * And the same fact from the other end. A card and the design behind it are
     * two files written months apart — the stub in free's `locked.json`, the
     * tree in Pro's library — so the id is the only thing joining them, and a
     * typo in either would leave the upsell standing beside the design.
     */
    public function testEveryBarAndSlideInStubHasARealDesignBehindIt(): void
    {
        $library = $this->library();

        $advertised = [
            'bar-announcement',
            'bar-email-capture',
            'bar-countdown',
            'slide-in-card',
            'slide-in-photo',
            'slide-in-review',
        ];

        foreach ($advertised as $id) {
            $this->assertNotNull($library->find($id), $id . ' is advertised in locked.json and shipped by nobody');
            $this->assertArrayNotHasKey($id, $library->locked());
        }
    }

    /**
     * ==========================================================================
     * THE CARD AND THE DESIGN MUST DESCRIBE THE SAME THING.
     * ==========================================================================
     * A locked stub's facets are the one place in the vocabulary they are
     * AUTHORED rather than derived ({@see \WConvert\Template\TemplateFacets}),
     * because a stub has no tree to read them off. So free's picker filters
     * these designs by hand-written facets and Pro's filters the same designs by
     * facets read off the tree — and if the two disagree, a merchant who
     * filtered by *"Side by side"* on free and then upgraded finds the design
     * somewhere else.
     */
    public function testAFreeInstallsCardDescribesTheDesignProActuallyShips(): void
    {
        $library = $this->library();
        $free = TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR),
            new LockedTemplates(self::FREE_DIR),
        );

        foreach ($free->locked() as $id => $stub) {
            $real = $library->find($id);

            if ($real === null) {
                continue;
            }

            /*
             * The THREE the picker filters by, and only those. `act` and
             * `asks_consent` are derived and travel with an entry, but a stub
             * has no tree to read them off and is never refused for its act
             * anyway — a design that is not offered is never refused
             * ({@see Gallery}'s `refusalFor`). Asserting them here would be
             * asserting that a card knows something it structurally cannot.
             */
            foreach (TemplateFacets::FILTERED as $facet) {
                $this->assertSame(
                    $stub['facets'][$facet],
                    $real['facets'][$facet],
                    sprintf('%s: the card and the design disagree about %s', $id, $facet)
                );
            }

            $this->assertSame($stub['display_type'], $real['display_type'], $id . ': the card and the design disagree');
        }
    }

    /**
     * Pro ships free's gallery too, so a customer does not lose the popups they
     * had. The one direction that would be wrong is Pro's designs appearing on
     * free, and free's tree cannot reach Pro's — which is what
     * `bin/verify-source-contract.sh` asserts one layer down.
     */
    public function testProKeepsEveryDesignFreeAlreadyHad(): void
    {
        $free = TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR),
        );

        $this->assertNotSame([], $free->all());
        $this->assertSame([], array_diff_key($free->all(), $this->library()->all()));
    }

    /** One bad file must not take the gallery down, and neither must no files. */
    public function testAnAbsentProLibraryIsAnEmptyListRatherThanAThrow(): void
    {
        $this->assertSame([], (new ProTemplates(__DIR__ . '/nowhere'))->entries());
    }
}
