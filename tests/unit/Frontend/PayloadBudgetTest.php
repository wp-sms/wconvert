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
        $template = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR)->find('centred-card');

        self::assertIsArray($template, 'the shipped template is what this measures');

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
                        'tree' => self::diverged($template['tree'], $i),
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
     * One snapshot, edited the way a merchant edits one: every word replaced.
     *
     * @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    private static function diverged(array $tree, int $i): array
    {
        $copy = [
            'Get %d%% off your very first order today',
            'Subscribers hear about the %dth sale first',
            'Save %d%% when you join the newsletter now',
            'Unlock a %d%% welcome discount this week',
            'Members get %d%% off every single order',
        ];

        $encoded = (string) json_encode($tree);

        // Replaced rather than appended, so the ten trees share structure and
        // share almost no text — which is exactly the case the ADR was unsure
        // about.
        return (array) json_decode(preg_replace_callback(
            '/"text":"[^"]*"/',
            static function (array $match) use ($copy, $i): string {
                static $slot = 0;

                return sprintf('"text":%s', (string) json_encode(sprintf($copy[$slot++ % count($copy)], 5 + $i)));
            },
            $encoded
        ) ?? $encoded, true);
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
