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
     * ==========================================================================
     * THE RULE WITH NO REMAINDER: A PRO INSTALL HAS NO LOCKED CARD AT ALL.
     * ==========================================================================
     * This used to filter for `floating_bar` and `slide_in`, because those were
     * the six of nine designs #95 shipped and three cards were still standing
     * on a Pro install — two designs nobody had authored yet, and one
     * ({@see \WConvert\Template\LockedTemplates} `popup-spin-to-win`) that could
     * never be authored at all. A test scoped to the Display Types that happened
     * to be finished is a test that reads green while a paying customer is
     * looking at an advertisement for what they bought.
     *
     * With the two designs authored and the third card **withdrawn**
     * (ADR 0053), `locked()` on Pro is empty, and that is the assertion ADR 0026
     * actually makes. It fails the day a ninth card is added to `locked.json`
     * without a design behind it in Pro's ZIP — which is the direction this
     * breaks, every time.
     */
    public function testAProInstallIsShownNoUpsellAtAll(): void
    {
        $this->assertSame([], array_keys($this->library()->locked()));
    }

    /**
     * And the same fact from the other end. A card and the design behind it are
     * two files written months apart — the stub in free's `locked.json`, the
     * tree in Pro's library — so the id is the only thing joining them, and a
     * typo in either would leave the upsell standing beside the design.
     *
     * The list is spelled out rather than read off `locked()`, which is what
     * makes it catch the *other* direction too: a card quietly deleted from
     * `locked.json` leaves free's gallery advertising one fewer design than Pro
     * ships, and nothing derived from that file can notice its own absence.
     */
    public function testEveryAdvertisedDesignHasARealDesignBehindIt(): void
    {
        $library = $this->library();

        $advertised = [
            'bar-announcement',
            'bar-email-capture',
            'bar-countdown',
            'slide-in-card',
            'slide-in-photo',
            'slide-in-review',
            'popup-two-column',
            'inline-cart-nudge',
            'bar-code',
            'bar-review',
            'bar-two-field',
            'slide-in-code',
            'slide-in-nudge',
            'slide-in-benefits',
            'popup-two-channel',
            'popup-editorial',
            'popup-flash',
            'inline-code-strip',
        ];

        foreach ($advertised as $id) {
            $this->assertNotNull($library->find($id), $id . ' is advertised in locked.json and shipped by nobody');
            $this->assertArrayNotHasKey($id, $library->locked());
        }
    }

    /**
     * ==========================================================================
     * THE WITHDRAWN CARD, AND WHY IT IS AN ASSERTION RATHER THAN A COMMENT.
     * ==========================================================================
     * `popup-spin-to-win` advertised a MECHANISM and not a design: a wheel that
     * allocates a prize. The payload is baked into HTML the full-page cache
     * serves byte-identically to every visitor, so either every segment's prize
     * ships in the page source or none does (ADR 0025); "one spin per visitor"
     * is a claim about a person, and WConvert mints no visitor identifier
     * (ADR 0017); and a stored outcome serves two purposes in two consent
     * categories at once, which is the question ADR 0052 parked and
     * **ADR 0053** answers.
     *
     * So the failure this guards is a pair, and both halves are one line
     * somebody adds:
     *
     * - the card coming back with nothing behind it — an upsell on a Pro
     *   install, for a design no tier can supply;
     * - a **tree** appearing under that id — which, since none of the three
     *   walls moved, could only be the wheel showing every visitor the same
     *   prize. That is the manufactured-urgency failure ADR 0052 refused,
     *   wearing a different hat.
     *
     * Reopening the decision therefore has to delete a test that names the ADR,
     * which is the point: it puts the argument in front of whoever reopens it
     * rather than behind a file they were not going to read.
     */
    public function testTheSpinToWinCardIsNeitherAdvertisedNorShipped(): void
    {
        $library = $this->library();

        $this->assertArrayNotHasKey('popup-spin-to-win', $library->locked(), 'withdrawn by ADR 0053');
        $this->assertNull($library->find('popup-spin-to-win'), 'withdrawn by ADR 0053');

        $free = TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR),
            new LockedTemplates(self::FREE_DIR),
        );

        $this->assertArrayNotHasKey('popup-spin-to-win', $free->locked(), 'withdrawn by ADR 0053');
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
