<?php

namespace WConvert\Tests\Unit\Targeting;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Targeting\RequestContext;
use WConvert\Targeting\Targeting;
use WConvert\Targeting\TargetingEvaluator;

/**
 * Targeting — the one axis of an Optin's rules evaluated on the server
 * (CONTEXT.md, ADR 0005), as a pure function of (rule list, request context).
 */
#[CoversClass(TargetingEvaluator::class)]
final class TargetingEvaluatorTest extends TestCase
{
    private static function post(int $id): RequestContext
    {
        return new RequestContext(path: '/hello-world/', isSingular: true, postId: $id, postType: 'post');
    }

    public function testAnIncludedPostMatchesThatPostAndNoOther(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'post', 'value' => 12]]]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::post(12)));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::post(13)));
    }

    /**
     * The property the whole axis turns on. Both lists match the same request,
     * and exclude wins — stated once here on `post`, and again on every other
     * prefix below, because a match() that special-cases one type is exactly
     * the regression this guards.
     */
    public function testExcludeBeatsIncludeWhenBothMatch(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'post', 'value' => 12]],
            'exclude' => [['type' => 'post', 'value' => 12]],
        ]);

        $this->assertFalse(TargetingEvaluator::matches($targeting, self::post(12)));
    }

    /**
     * An empty include list is "everywhere", not "nowhere". An Optin the
     * merchant never restricted is site-wide, which is the only reading that
     * makes an exclude-only list — "everywhere except the checkout" — mean
     * anything.
     */
    public function testAnEmptyIncludeListMatchesEveryPage(): void
    {
        $this->assertTrue(TargetingEvaluator::matches(Targeting::fromArray([]), self::post(12)));
    }

    public function testAnEmptyIncludeListStillLosesToAnExclude(): void
    {
        $targeting = Targeting::fromArray(['exclude' => [['type' => 'post', 'value' => 12]]]);

        $this->assertFalse(TargetingEvaluator::matches($targeting, self::post(12)));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::post(13)));
    }

    public function testSingularMatchesEveryPostOfThatTypeAndNoOtherType(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'singular', 'value' => 'page']]]);

        $page = new RequestContext(path: '/about/', isSingular: true, postId: 4, postType: 'page');

        $this->assertTrue(TargetingEvaluator::matches($targeting, $page));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::post(12)));
    }

    public function testSingularDoesNotMatchAnArchiveOfThatType(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'singular', 'value' => 'product']]]);

        $archive = new RequestContext(path: '/shop/', archivePostType: 'product');

        $this->assertFalse(TargetingEvaluator::matches($targeting, $archive));
    }

    public function testSingularExcludeBeatsAPostInclude(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'post', 'value' => 12]],
            'exclude' => [['type' => 'singular', 'value' => 'post']],
        ]);

        $this->assertFalse(TargetingEvaluator::matches($targeting, self::post(12)));
    }

    public function testArchiveMatchesThePostTypeArchiveAndNotItsSingulars(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'archive', 'value' => 'product']]]);

        $archive = new RequestContext(path: '/shop/', archivePostType: 'product');
        $single = new RequestContext(path: '/shop/mug/', isSingular: true, postId: 8, postType: 'product');

        $this->assertTrue(TargetingEvaluator::matches($targeting, $archive));
        $this->assertFalse(TargetingEvaluator::matches($targeting, $single));
    }

    public function testArchiveExcludeBeatsAnArchiveInclude(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'archive', 'value' => 'product']],
            'exclude' => [['type' => 'archive', 'value' => 'product']],
        ]);

        $this->assertFalse(
            TargetingEvaluator::matches($targeting, new RequestContext(path: '/shop/', archivePostType: 'product'))
        );
    }

    /**
     * `term:` is one rule over one field, and it deliberately covers both
     * places a term puts itself on a page: the term's own archive, and a
     * singular post carrying it. A merchant choosing "News" means both, and
     * splitting it into two rule types would make the obvious choice the wrong
     * one half the time.
     */
    public function testTermMatchesBothItsArchiveAndAPostCarryingIt(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'term', 'value' => 7]]]);

        $archive = new RequestContext(path: '/category/news/', termIds: [7]);
        $inNews = new RequestContext(path: '/hello/', isSingular: true, postId: 12, postType: 'post', termIds: [7, 9]);
        $elsewhere = new RequestContext(path: '/other/', isSingular: true, postId: 13, postType: 'post', termIds: [9]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, $archive));
        $this->assertTrue(TargetingEvaluator::matches($targeting, $inNews));
        $this->assertFalse(TargetingEvaluator::matches($targeting, $elsewhere));
    }

    public function testTermExcludeBeatsASingularInclude(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'singular', 'value' => 'post']],
            'exclude' => [['type' => 'term', 'value' => 7]],
        ]);

        $inNews = new RequestContext(path: '/hello/', isSingular: true, postId: 12, postType: 'post', termIds: [7]);

        $this->assertFalse(TargetingEvaluator::matches($targeting, $inNews));
    }

    private static function at(string $path): RequestContext
    {
        return new RequestContext(path: $path);
    }

    /**
     * A trailing slash is not a targeting decision. WordPress serves
     * `/pricing/` and a merchant types `/pricing`, and an Optin that silently
     * fails to show over that difference is the support ticket ADR 0005 wrote
     * the readable pass/fail table for.
     */
    public function testUrlIgnoresTheTrailingSlashOnBothSides(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'url', 'value' => '/pricing']]]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/pricing/')));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/pricing')));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::at('/pricing-plans/')));
    }

    public function testUrlStarMatchesAnyRunIncludingSlashes(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'url', 'value' => '/blog/*']]]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/blog/hello/')));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/blog/2026/03/hello/')));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/blog/')));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::at('/news/hello/')));
    }

    /**
     * The glob is a glob, not a regular expression. `*` is the only
     * metacharacter; everything else is a literal, so a dot in a path does not
     * quietly become "any character".
     */
    public function testUrlTreatsRegexMetacharactersAsLiterals(): void
    {
        $targeting = Targeting::fromArray(['include' => [['type' => 'url', 'value' => '/a.b']]]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/a.b')));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::at('/axb')));
    }

    public function testUrlExcludeBeatsAUrlInclude(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'url', 'value' => '/blog/*']],
            'exclude' => [['type' => 'url', 'value' => '/blog/drafts/*']],
        ]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::at('/blog/hello/')));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::at('/blog/drafts/hello/')));
    }

    private static function visitor(bool $loggedIn): RequestContext
    {
        return new RequestContext(path: '/pricing/', isLoggedIn: $loggedIn);
    }

    public function testLoggedInIsNotAskedWhenItIsUnset(): void
    {
        $targeting = Targeting::fromArray([]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::visitor(true)));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::visitor(false)));
    }

    public function testLoggedInNarrowsToMembersOrToStrangers(): void
    {
        $members = Targeting::fromArray(['logged_in' => true]);
        $strangers = Targeting::fromArray(['logged_in' => false]);

        $this->assertTrue(TargetingEvaluator::matches($members, self::visitor(true)));
        $this->assertFalse(TargetingEvaluator::matches($members, self::visitor(false)));

        $this->assertFalse(TargetingEvaluator::matches($strangers, self::visitor(true)));
        $this->assertTrue(TargetingEvaluator::matches($strangers, self::visitor(false)));
    }

    /**
     * `logged_in` narrows; it never widens. It is a visitor predicate ANDed
     * over the page set, not another member of the include union — an include
     * list is a UNION of page sets, so a visitor rule dropped into it would
     * show the Optin on every page of the site to anyone who matched it.
     *
     * It lives on the server axis at all only because the client cannot read
     * WordPress's HttpOnly auth cookie.
     */
    public function testLoggedInNarrowsThePageSetRatherThanWideningIt(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'url', 'value' => '/pricing']],
            'logged_in' => false,
        ]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::visitor(false)));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::visitor(true)));
        $this->assertFalse(TargetingEvaluator::matches(
            $targeting,
            new RequestContext(path: '/about/', isLoggedIn: false)
        ));
    }

    // ========================================================================
    // THE SECOND VISITOR PREDICATE, AND THE SAME RULES.
    // ========================================================================

    /**
     * @param list<string> $held
     */
    private static function holding(array $held): RequestContext
    {
        return new RequestContext(path: '/pricing/', isLoggedIn: $held !== [], roles: $held);
    }

    public function testRolesAreNotAskedWhenNoneWereChosen(): void
    {
        $targeting = Targeting::fromArray([]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding(['subscriber'])));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding([])));
    }

    /**
     * **ANY of them, never all.** The real OR cases are one rule carrying
     * several values (ADR 0005), and nobody holds two membership levels and a
     * WordPress role at once by design — a set read as AND would be a rule
     * that holds for nobody on every install.
     */
    public function testAVisitorNeedsAnyOneOfTheChosenRoles(): void
    {
        $targeting = Targeting::fromArray(['roles' => ['subscriber', 'plan_gold']]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding(['subscriber'])));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding(['plan_gold'])));
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding(['customer', 'plan_gold'])));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::holding(['customer'])));
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::holding([])));
    }

    /**
     * **An emptied control is *any role*, never *no role*.**
     *
     * Read as a set, an empty one holds for nobody — which would make an Optin
     * that is published and can never show, a state the merchant has no word
     * for. So `Targeting::fromArray()` collapses it to null on the way in and
     * the evaluator never sees one.
     */
    public function testAnEmptiedRoleSetIsDoNotAskRatherThanNobody(): void
    {
        $targeting = Targeting::fromArray(['roles' => []]);

        $this->assertNull($targeting->roles);
        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding([])));
    }

    /**
     * ========================================================================
     * THE FAILURE THIS PREDICATE IS HELD APART TO PREVENT.
     * ========================================================================
     * A role rule dropped into an include list would not narrow the Optin — it
     * would WIDEN it to the whole site for anyone holding that role, because
     * the list is a UNION of page sets. There is no error and no screen that
     * says so; the merchant's "subscribers only, on the pricing page" popup
     * simply shows to every subscriber on every page.
     *
     * Held as a field it is ANDed over the page set, which is what this
     * asserts: a subscriber on the wrong page still sees nothing.
     */
    public function testRolesNarrowThePageSetRatherThanWideningIt(): void
    {
        $targeting = Targeting::fromArray([
            'include' => [['type' => 'url', 'value' => '/pricing']],
            'roles' => ['subscriber'],
        ]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding(['subscriber'])));

        // The right visitor, the wrong page.
        $this->assertFalse(TargetingEvaluator::matches(
            $targeting,
            new RequestContext(path: '/about/', isLoggedIn: true, roles: ['subscriber'])
        ));

        // The right page, the wrong visitor.
        $this->assertFalse(TargetingEvaluator::matches($targeting, self::holding(['customer'])));
    }

    /**
     * **The save half of the round trip**, which is the half a value object
     * can lose quietly: a field read correctly and written back as nothing is
     * a merchant's rule that disappears on their next edit.
     *
     * An emptied set is dropped rather than stored, for the reason above — and
     * that is what makes *"an emptied control is any role"* survive a save
     * rather than only a load.
     */
    public function testWhatIsStoredIsWhatWasChosen(): void
    {
        $chosen = Targeting::fromArray(['roles' => ['subscriber', 'plan_gold']]);

        $this->assertSame(['roles' => ['subscriber', 'plan_gold']], $chosen->toArray());

        // Round-tripped through storage, which is what the save route does.
        $this->assertSame($chosen->toArray(), Targeting::fromArray($chosen->toArray())->toArray());

        $this->assertSame([], Targeting::fromArray(['roles' => []])->toArray());
        $this->assertSame([], Targeting::fromArray(['roles' => 'subscriber'])->toArray());
    }

    /** Both predicates hold at once, which is the implicit AND of the axis. */
    public function testTheTwoVisitorPredicatesBothHaveToHold(): void
    {
        $targeting = Targeting::fromArray(['logged_in' => true, 'roles' => ['subscriber']]);

        $this->assertTrue(TargetingEvaluator::matches($targeting, self::holding(['subscriber'])));
        $this->assertFalse(TargetingEvaluator::matches(
            $targeting,
            new RequestContext(path: '/pricing/', isLoggedIn: false, roles: ['subscriber'])
        ));
    }
}
