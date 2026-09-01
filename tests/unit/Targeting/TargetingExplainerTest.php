<?php

namespace WConvert\Tests\Unit\Targeting;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Targeting\RequestContext;
use WConvert\Targeting\Targeting;
use WConvert\Targeting\TargetingEvaluator;
use WConvert\Targeting\TargetingExplainer;

/**
 * The server half of the eligibility inspector.
 *
 * ============================================================================
 * WHAT IS UNDER TEST IS THAT IT NEVER DISAGREES WITH THE EVALUATOR.
 * ============================================================================
 * A diagnostic that computes its own answer can be wrong about the very thing
 * it exists to explain, and the merchant would believe the screen over the
 * site. So the verdict is {@see TargetingEvaluator::matches()}'s and only the
 * per-rule detail is this class's — and the exhaustive case below is what
 * holds the two together across every shape of Targeting the model allows.
 */
#[CoversClass(TargetingExplainer::class)]
final class TargetingExplainerTest extends TestCase
{
    /**
     * @param array<string, mixed> $over
     */
    private static function context(array $over = []): RequestContext
    {
        return new RequestContext(
            path: $over['path'] ?? '/pricing',
            isSingular: $over['isSingular'] ?? true,
            postId: $over['postId'] ?? 42,
            postType: $over['postType'] ?? 'page',
            archivePostType: $over['archivePostType'] ?? null,
            termIds: $over['termIds'] ?? [],
            isLoggedIn: $over['isLoggedIn'] ?? false,
        );
    }

    public function testAnUnrestrictedOptinIsAdmittedEverywhereWithNoReason(): void
    {
        $report = TargetingExplainer::explain(Targeting::fromArray([]), self::context());

        $this->assertTrue($report['admits']);
        $this->assertNull($report['reason']);
        $this->assertSame([], $report['include']);
        $this->assertSame([], $report['exclude']);
        $this->assertNull($report['logged_in']);
    }

    /** Every rule gets a row, matching or not — that is what makes it a table. */
    public function testItReportsEveryRuleOnBothLists(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray([
                'include' => [
                    ['type' => 'url', 'value' => '/pricing'],
                    ['type' => 'url', 'value' => '/about'],
                ],
                'exclude' => [['type' => 'post', 'value' => '99']],
            ]),
            self::context()
        );

        $this->assertTrue($report['admits']);
        $this->assertSame(
            [
                ['type' => 'url', 'value' => '/pricing', 'matches' => true],
                ['type' => 'url', 'value' => '/about', 'matches' => false],
            ],
            $report['include']
        );
        $this->assertSame([['type' => 'post', 'value' => '99', 'matches' => false]], $report['exclude']);
    }

    /**
     * **Exclude is a veto, not a filter over the include list's result**, and
     * the reason has to say so: a merchant told to fix their include list when
     * the checkout is in their exclude list is worse off than one told nothing.
     */
    public function testAnExcludedPageNamesTheExcludeListEvenWhenIncludeMatchedToo(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray([
                'include' => [['type' => 'url', 'value' => '/pricing']],
                'exclude' => [['type' => 'url', 'value' => '/pricing']],
            ]),
            self::context()
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::EXCLUDED, $report['reason']);
        // Both rows are still true. The table reports what each rule did; the
        // reason reports which gate closed.
        $this->assertTrue($report['include'][0]['matches']);
        $this->assertTrue($report['exclude'][0]['matches']);
    }

    public function testANonEmptyIncludeListThatMatchesNothingNamesItself(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['include' => [['type' => 'url', 'value' => '/about']]]),
            self::context()
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::NOT_INCLUDED, $report['reason']);
    }

    /**
     * ========================================================================
     * THE ONE QUESTION THE INSPECTOR CANNOT SIMULATE, REPORTED AS A FACT ABOUT
     * THIS REQUEST.
     * ========================================================================
     * The merchant is signed in — that is what grants them `manage_options` —
     * so "what does a signed-out visitor see" is unanswerable and must be said
     * rather than faked. The predicate is reported as *wanted* against *holds*
     * so the panel can say "this shows only to signed-out visitors, and you
     * are signed in".
     */
    public function testTheVisitorPredicateIsReportedAsWantedAgainstThisRequest(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['logged_in' => false]),
            self::context(['isLoggedIn' => true])
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::WRONG_VISITOR, $report['reason']);
        $this->assertSame(['wanted' => false, 'holds' => false], $report['logged_in']);
    }

    /** And the predicate wins over the lists, because the evaluator asks it first. */
    public function testTheVisitorPredicateNamesItselfEvenWhenTheListsWouldAlsoRefuse(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['logged_in' => true, 'include' => [['type' => 'url', 'value' => '/about']]]),
            self::context()
        );

        $this->assertSame(TargetingExplainer::WRONG_VISITOR, $report['reason']);
    }

    /**
     * ========================================================================
     * THE VERDICT IS THE EVALUATOR'S, ACROSS EVERY SHAPE THE MODEL ALLOWS.
     * ========================================================================
     * Two lists of nought, one or two rules, each matching or not, against the
     * three states of the visitor predicate. What this holds is that
     * `admits` never disagrees with {@see TargetingEvaluator::matches()} and
     * that `reason` is null on exactly the ones it admits — the pair that
     * cannot occur is a positive verdict carrying a cause.
     */
    public function testItNeverDisagreesWithTheEvaluatorItExplains(): void
    {
        $matching = ['type' => 'url', 'value' => '/pricing'];
        $missing = ['type' => 'url', 'value' => '/about'];
        $lists = [[], [$matching], [$missing], [$matching, $missing]];
        $checked = 0;

        foreach ($lists as $include) {
            foreach ($lists as $exclude) {
                foreach ([null, true, false] as $loggedIn) {
                    foreach ([true, false] as $visitorIsSignedIn) {
                        $config = ['include' => $include, 'exclude' => $exclude];

                        if ($loggedIn !== null) {
                            $config['logged_in'] = $loggedIn;
                        }

                        $targeting = Targeting::fromArray($config);
                        $context = self::context(['isLoggedIn' => $visitorIsSignedIn]);
                        $report = TargetingExplainer::explain($targeting, $context);
                        $where = (string) json_encode([$config, $visitorIsSignedIn]);

                        $this->assertSame(
                            TargetingEvaluator::matches($targeting, $context),
                            $report['admits'],
                            $where
                        );
                        $this->assertSame($report['admits'], $report['reason'] === null, $where);

                        $checked++;
                    }
                }
            }
        }

        $this->assertSame(96, $checked);
    }
}
