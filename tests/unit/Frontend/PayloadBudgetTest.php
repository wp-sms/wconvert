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
        $entries = Payload::forRequest(self::worstCase(), new RequestContext(path: '/pricing/'));

        $this->assertCount(self::ON_THE_PAGE, $entries, 'every one of them has to actually be on the page');

        $gzipped = strlen((string) gzencode(PayloadTag::render($entries), 9));

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
        $entries = Payload::forRequest(self::worstCase(), new RequestContext(path: '/pricing/'));
        $rendered = PayloadTag::render($entries);

        $this->assertStringContainsString('"steps"', $rendered);
        $this->assertGreaterThan(self::BUDGET, strlen($rendered), 'uncompressed, ten trees are well over the budget');
    }
}
