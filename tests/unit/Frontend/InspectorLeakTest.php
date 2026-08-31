<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\InspectorEnqueue;
use WConvert\Frontend\InspectorTag;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * ============================================================================
 * WHAT THE INSPECTOR MUST NEVER PRINT, AND FOR WHOM.
 * ============================================================================
 * The report names **every Optin on the site**, published and draft, with the
 * Targeting rules behind each — rules the ordinary payload deliberately strips
 * before it reaches a browser at all. It is the single richest thing this
 * plugin could accidentally put on a public URL, and it is printed into a
 * FRONT-END page, so the gate is a `current_user_can()` at enqueue rather than
 * a `permission_callback` a route test would cover.
 *
 * That is why this file exists: the check lives outside the REST layer, where
 * none of the four route-count assertions can see it.
 *
 * **Nothing, not an empty panel.** A visitor who is not an administrator gets
 * no script and no tag — not a hidden one, not one with the rows filtered out.
 * A filtered payload is a payload, and the filter is the part that gets
 * refactored.
 */
#[CoversClass(InspectorEnqueue::class)]
#[CoversClass(InspectorTag::class)]
final class InspectorLeakTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestScripts'] = ['registered' => [], 'enqueued' => []];
        $GLOBALS['wconvertTestCapabilities'] = [];
        $GLOBALS['wconvertTestRequestKind'] = [];
        $GLOBALS['wconvertTestIsAdmin'] = false;
        $GLOBALS['wconvertTestNocache'] = false;

        unset($_GET[InspectorEnqueue::PARAM]);
    }

    protected function tearDown(): void
    {
        unset($_GET[InspectorEnqueue::PARAM]);
    }

    private function inspector(): InspectorEnqueue
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $published = new PublishedSet(new FakeOptionStore());
        $pro = new FakeProPresence(false);
        $site = new FakeSitePresence([]);

        return new InspectorEnqueue(
            new OptinRepository(new FakeConnection(), $published, $vocabulary),
            $published,
            InstalledRules::free($vocabulary),
            new RuleCatalogue($vocabulary, $pro, $site)
        );
    }

    /** Did this request produce anything at all? */
    private function printedSomething(): bool
    {
        return $GLOBALS['wconvertTestScripts']['enqueued'] !== []
            || $GLOBALS['wconvertTestScripts']['registered'] !== []
            || ($GLOBALS['wconvertTestActions']['wp_head'] ?? []) !== [];
    }

    public function testALoggedOutVisitorAskingForItGetsNothing(): void
    {
        $_GET[InspectorEnqueue::PARAM] = '1';

        $this->inspector()->enqueue();

        $this->assertFalse($this->printedSomething(), 'the inspector reached a logged-out visitor');
    }

    /**
     * **A subscriber is the case a capability check exists for.** They are
     * logged in, so a gate written as "is anybody signed in" would pass — and
     * on a membership site that is most of the audience.
     */
    public function testASubscriberAskingForItGetsNothing(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['read'];
        $_GET[InspectorEnqueue::PARAM] = '1';

        $this->inspector()->enqueue();

        $this->assertFalse($this->printedSomething(), 'the inspector reached a subscriber');
    }

    /** And an administrator who did not ask gets nothing either. */
    public function testAnAdministratorWhoDidNotAskGetsNothing(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [Routes::MANAGE_CAPABILITY];

        $this->inspector()->enqueue();

        $this->assertFalse($this->printedSomething(), 'the inspector ran on an ordinary page view');
    }

    /**
     * A feed, a robots.txt and an oEmbed response are not pages a visitor is
     * looking at, and printing a script tag into one corrupts it — an
     * administrator reading their own feed included.
     */
    public function testItPrintsNothingIntoAFeedARobotsFileOrAnEmbed(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [Routes::MANAGE_CAPABILITY];
        $_GET[InspectorEnqueue::PARAM] = '1';

        foreach (['is_feed', 'is_robots', 'is_embed'] as $kind) {
            $GLOBALS['wconvertTestActions'] = [];
            $GLOBALS['wconvertTestScripts'] = ['registered' => [], 'enqueued' => []];
            $GLOBALS['wconvertTestRequestKind'] = [$kind => true];

            $this->inspector()->enqueue();

            $this->assertFalse($this->printedSomething(), $kind);
        }
    }

    /**
     * ========================================================================
     * THE POSITIVE CONTROL, WITHOUT WHICH EVERY REFUSAL ABOVE PASSES ON A
     * FEATURE THAT DOES NOT WORK.
     * ========================================================================
     * `nocache_headers()` is the first thing past the gate and runs before the
     * bundle is looked for on disk, so it is what says "an administrator who
     * asked got through" in a suite that has no build artifact to find.
     *
     * It is also the assertion for the cache half in its own right: the panel
     * reports live state on a page a merchant may have cached, and a cached
     * copy of THIS response would be the report of somebody else's page view.
     */
    public function testAnAdministratorWhoAsksGetsThroughAndTheResponseIsMarkedUncacheable(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [Routes::MANAGE_CAPABILITY];
        $_GET[InspectorEnqueue::PARAM] = '1';

        $this->inspector()->enqueue();

        $this->assertTrue($GLOBALS['wconvertTestNocache'], 'the gate refused an administrator who asked');
        // `constant()` rather than `defined()`: the constant is a fact about
        // this process, and asking for its VALUE is what says a page cache was
        // told to skip the response rather than merely that the name exists.
        $this->assertSame(true, constant('DONOTCACHEPAGE'), 'a page cache was not told to skip this response');
    }

    /** And nobody else gets that far, which is what makes the control a control. */
    public function testNobodyElseReachesTheCacheHeaders(): void
    {
        $_GET[InspectorEnqueue::PARAM] = '1';

        $this->inspector()->enqueue();

        $this->assertFalse($GLOBALS['wconvertTestNocache']);
    }

    /**
     * **The gate is the one the admin screens use**, named rather than
     * written out — so the inspector and the routes can never come to disagree
     * about who may see this.
     */
    public function testTheGateIsTheSameCapabilityEveryAdminSurfaceUses(): void
    {
        $this->assertSame('manage_options', Routes::MANAGE_CAPABILITY);
    }

    /**
     * ========================================================================
     * AND THE TAG ITSELF ESCAPES FOR ITS CONTEXT, BECAUSE IT CARRIES NAMES.
     * ========================================================================
     * An Optin name is merchant input, and this tag carries names where the
     * payload does not. Without `JSON_HEX_TAG` a name containing `</script>`
     * closes the element early and the rest of the report becomes markup.
     */
    public function testAnOptinNameCannotCloseTheScriptElement(): void
    {
        $tag = InspectorTag::render(
            [['id' => '01JQ0000000000000000000001', 'name' => '</script><img src=x>', 'published_at' => null]],
            [],
            [],
            new \WConvert\Targeting\RequestContext(),
            []
        );

        $this->assertStringNotContainsString('</script><img', $tag);
        $this->assertStringContainsString('</script', $tag);
    }
}
