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
}
