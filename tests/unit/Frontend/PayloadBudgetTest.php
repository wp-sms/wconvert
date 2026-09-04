<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\Payload;
use WConvert\Frontend\PayloadTag;
use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * The 2KB gzipped per-page payload bound, against real snapshotted trees.
 *
 * ADR 0010 shipped with this booked as **unverified**: "that ten snapshotted
 * trees on one page still gzip inside the 2KB payload budget. #9 measured ten
 * rule-set projections at 5.7KB raw compressing to 621 bytes because they are
 * near-identical text; template trees drawn from one closed vocabulary should
 * be more self-similar, not less, but this is a prediction." This is the test
 * that settles it, and the prediction is the thing under test — so the fixture
 * is built to be as UNLIKE ten copies of one tree as a real install can get.
 *
 * If it ever fails, the recorded fix is delta-encoding each Optin against its
 * `template_id` — rejected up front because snapshots diverge from their
 * source by design and the delta would need the source *version* too.
 *
 * Ten because that is the number the ADR names. Ten Optins matching ONE page
 * is already beyond what the rule engine will show — at most one overlay wins
 * a page view — so it is a worst case for bytes rather than a plausible
 * configuration.
 */
#[CoversClass(Payload::class)]
#[CoversClass(PayloadTag::class)]
final class PayloadBudgetTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** ≤2KB gzipped, per page (ADR 0010, issue #9). */
    private const BUDGET = 2048;

    private const ON_THE_PAGE = 10;

    /**
     * The site-wide allowance at its **largest**, so its bytes are inside the
     * measurement rather than beside it.
     *
     * Every field set and both switches off is the most
     * {@see \WConvert\Optin\SiteFrequency::forPayload()} can produce — `true`
     * never travels, so an allowance with both switches ON is SHORTER than
     * this one. Most sites send null and pay nothing; this is the page that
     * pays the most (ADR 0047).
     */
    private const SITE_ALLOWANCE = [
        'maxImpressions' => 99,
        'cooldownDays' => 99,
        'stopAfterDismiss' => false,
        'stopAfterConversion' => false,
    ];

    /**
     * Ten published Optins, all matching one page, each carrying its own
     * diverged snapshot of the shipped Template.
     *
     * Every one differs in its copy, its tokens and its rules, because
     * identical entries would compress to almost nothing and the assertion
     * would prove only that gzip works.
     *
     * @return list<PublishedOptin>
     */
    private static function worstCase(): array
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $library = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);

        // What an Optin actually carries: the SNAPSHOT — the shipped design
        // with the gallery's placeholder words taken out of it — and then the
        // merchant's own words written back onto its Slot Roles. Measuring the
        // gallery entry instead would measure copy no visitor ever sees.
        $snapshot = $library->snapshotInto(['template_id' => 'centred-card']);

        self::assertArrayHasKey('template', $snapshot, 'the shipped template is what this measures');

        $template = $snapshot['template'];
        $set = [];

        for ($i = 0; $i < self::ON_THE_PAGE; $i++) {
            $set[] = [
                'id' => sprintf('01JQ%022d', $i),
                'targeting' => ['include' => [['type' => 'url', 'value' => '/pricing']]],
                'payload' => [
                    'display_type' => 'popup',
                    'template_id' => 'centred-card',
                    'priority' => $i,
                    'template' => [
                        'tree' => self::withCopy($template['tree'], $i),
                        'tokens' => ['accent' => sprintf('#%06x', 0x2563EB + $i * 4919)] + $template['tokens'],
                    ],
                    'triggers' => [['type' => 'time_on_page', 'seconds' => 5 + $i]],
                    'conditions' => [['type' => 'device', 'in' => ['mobile', 'tablet']]],
                    'frequency' => ['maxImpressions' => 3, 'cooldownDays' => 7, 'stopAfterDismiss' => true],
                ],
            ];
        }

        return PublishedOptin::fromSet($set);
    }

    /**
     * One snapshot with words written onto its slots, the way a Playbook or a
     * merchant fills one — and every Optin's words different from every
     * other's.
     *
     * That divergence is the point. Ten copies of one tree would compress to
     * almost nothing and the assertion would prove only that gzip works; these
     * ten share structure and share almost no text, which is exactly the case
     * ADR 0010 was unsure about.
     *
     * @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    private static function withCopy(array $tree, int $i): array
    {
        $copy = [
            'Get %d%% off your very first order today',
            'Subscribers hear about the %dth sale first',
            'Save %d%% when you join the newsletter now',
            'Unlock a %d%% welcome discount this week',
            'Members get %d%% off every single order',
        ];

        $slot = 0;
        $fill = static function (array $node) use (&$fill, $copy, $i, &$slot): array {
            if (in_array($node['type'], ['heading', 'text', 'button', 'field'], true)) {
                $words = sprintf($copy[$slot++ % count($copy)], 5 + $i);

                $node[$node['type'] === 'button' ? 'label' : 'text'] = $words;
            }

            foreach (['children', 'start', 'end'] as $key) {
                if (isset($node[$key]) && is_array($node[$key])) {
                    $node[$key] = array_map($fill, $node[$key]);
                }
            }

            return $node;
        };

        return ['steps' => array_map($fill, $tree['steps'])];
    }

    public function testTenSnapshottedTreesOnOnePageFitTheGzippedPayloadBudget(): void
    {
        $entries = Payload::forRequest(self::worstCase(), new RequestContext(path: '/pricing/'), InstalledRules::free());

        $this->assertCount(self::ON_THE_PAGE, $entries, 'every one of them has to actually be on the page');

        $gzipped = strlen((string) gzencode(PayloadTag::render(
            $entries,
            'https://example.test/wp-json/wconvert/v1/capture',
            'https://example.test/wp-json/wconvert/v1/beacon',
            self::SITE_ALLOWANCE
        ), 9));

        $this->assertLessThanOrEqual(
            self::BUDGET,
            $gzipped,
            sprintf('the per-page payload is %d B gzipped against a %d B budget', $gzipped, self::BUDGET)
        );
    }

    /**
     * The other side of it, so the assertion above cannot be satisfied by a
     * payload that is small because the trees never reached it.
     */
    public function testTheMeasuredPayloadActuallyCarriesTheTrees(): void
    {
        $entries = Payload::forRequest(self::worstCase(), new RequestContext(path: '/pricing/'), InstalledRules::free());
        $rendered = PayloadTag::render(
            $entries,
            'https://example.test/wp-json/wconvert/v1/capture',
            'https://example.test/wp-json/wconvert/v1/beacon',
            self::SITE_ALLOWANCE
        );

        $this->assertStringContainsString('"steps"', $rendered);
        $this->assertGreaterThan(self::BUDGET, strlen($rendered), 'uncompressed, ten trees are well over the budget');
    }

    /**
     * ==========================================================================
     * THE LIBRARY GREW FOUR TIMES AND THE PAYLOAD DID NOT MOVE. IT MUST NOT.
     * ==========================================================================
     * `template_id` is **provenance** (ADR 0010, CONTEXT.md Template): an Optin
     * carries a COPY of the design it started from, and the registry is not
     * consulted at render time. That is why three designs became twelve — with
     * nine more advertised — without a byte of it reaching a visitor's page.
     *
     * The way that would break is not a design decision anybody would argue
     * for; it is a convenience. A future ticket wants the design's NAME on a
     * beacon, or its `tier` for a report, or its `facets` for a segment — each
     * is one line in a projection, each is per-entry, and every one of them is
     * paid by every visitor of every matching page against a 2KB budget.
     *
     * So the assertion is about the KEYS the index route added, named
     * individually: they are the ones that exist now and could be reached for.
     * The budget test above would eventually catch it, in the sense that a
     * failing budget catches everything — this says which line did it.
     */
    public function testNothingAboutTheLIBRARYReachesTheBrowser(): void
    {
        $entries = Payload::forRequest(self::worstCase(), new RequestContext(path: '/pricing/'), InstalledRules::free());
        $rendered = PayloadTag::render(
            $entries,
            'https://example.test/wp-json/wconvert/v1/capture',
            'https://example.test/wp-json/wconvert/v1/beacon',
            self::SITE_ALLOWANCE
        );

        // Not `"name"`: a `field` node carries one, and it is what the capture
        // path requires the visitor to fill in. The entry NAMES are asserted
        // absent below, where the comparison is against the library itself.
        foreach (['"tier"', '"facets"', '"availability"', '"preview_url"'] as $key) {
            $this->assertStringNotContainsString(
                $key,
                $rendered,
                $key . ' is an index field and belongs to the admin, not to a visitor\'s page'
            );
        }

        // And the provenance that IS carried, so the assertion above cannot be
        // satisfied by a payload that stopped naming its design at all.
        $this->assertStringContainsString('"template_id":"centred-card"', $rendered);
    }

    /**
     * **A design nobody picked never reaches a page**, however many the library
     * holds. Measured rather than argued: the same ten Optins render the same
     * bytes with twelve designs shipped as they would with three, because the
     * registry is not in this path at all.
     */
    public function testAnUnpickedDesignCostsAVisitorNothing(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $library = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);

        $this->assertGreaterThan(1, count($library->all()), 'this asserts nothing on a one-design library');

        $entries = Payload::forRequest(self::worstCase(), new RequestContext(path: '/pricing/'), InstalledRules::free());
        $rendered = PayloadTag::render(
            $entries,
            'https://example.test/wp-json/wconvert/v1/capture',
            'https://example.test/wp-json/wconvert/v1/beacon',
            self::SITE_ALLOWANCE
        );

        foreach ($library->all() as $id => $entry) {
            if ($id === 'centred-card') {
                continue;
            }

            $this->assertStringNotContainsString((string) $entry['name'], $rendered, $id . ' reached the page');
        }

        foreach ($library->locked() as $id => $entry) {
            $this->assertStringNotContainsString((string) $entry['name'], $rendered, $id . ' reached the page');
        }
    }
}
