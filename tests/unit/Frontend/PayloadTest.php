<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Frontend\Payload;
use WConvert\Frontend\PayloadTag;
use WConvert\Optin\PublishedOptin;
use WConvert\Targeting\RequestContext;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * What the page actually receives: the published set, filtered to this
 * request, with the server-evaluated axis stripped rather than shipped
 * (ADR 0003, ADR 0005).
 */
#[CoversClass(Payload::class)]
#[CoversClass(PayloadTag::class)]
#[CoversClass(PublishedOptin::class)]
#[CoversClass(LoaderEnqueue::class)]
final class PayloadTest extends TestCase
{
    /** Where the capture endpoint is on this site, as `LoaderEnqueue` resolves it. */
    private const CAPTURE = 'https://example.test/wp-json/wconvert/v1/capture';

    private const BEACON = 'https://example.test/wp-json/wconvert/v1/beacon';

    /** The site's own clock, as `wp_timezone()->getName()` answers it. */
    private const ZONE = 'Europe/London';

    /**
     * Built from the STORED shape rather than by hand, so these tests keep
     * exercising the parse the front end actually does.
     *
     * @param array<string, mixed> $targeting
     * @return list<PublishedOptin>
     */
    private static function projection(string $id, array $targeting): array
    {
        return PublishedOptin::fromSet([
            ['id' => $id, 'targeting' => $targeting, 'payload' => ['display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
        ]);
    }

    public function testAnOptinTargetedAtOnePageIsPresentThereAndAbsentEverywhereElse(): void
    {
        $set = self::projection('01A', ['include' => [['type' => 'post', 'value' => 12]]]);

        $onTarget = new RequestContext(path: '/hello/', isSingular: true, postId: 12, postType: 'post');
        $elsewhere = new RequestContext(path: '/other/', isSingular: true, postId: 13, postType: 'post');

        $this->assertSame(['01A'], array_column(Payload::forRequest($set, $onTarget, InstalledRules::free()), 'id'));
        $this->assertSame([], Payload::forRequest($set, $elsewhere, InstalledRules::free()));
    }

    public function testTargetingIsStrippedFromWhatTheBrowserReceives(): void
    {
        $set = self::projection('01A', ['include' => [['type' => 'url', 'value' => '/secret-staging-path']]]);
        $context = new RequestContext(path: '/secret-staging-path/');

        $entries = Payload::forRequest($set, $context, InstalledRules::free());

        $this->assertSame([['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']], $entries);
        $this->assertStringNotContainsString('secret-staging-path', PayloadTag::render($entries, self::CAPTURE, self::BEACON, null, self::ZONE));
    }

    /**
     * **A role never reaches the browser, and it is the sharpest case of the
     * rule above.**
     *
     * Targeting is server-evaluated and stripped from the payload, so what a
     * cached page carries is the survivors and not the reasons — and the
     * reasons here are the slugs of a site's own roles and membership levels.
     * A page listing them would be telling every visitor how the site tells
     * its members apart, on every page an Optin matched.
     */
    public function testARoleTargetIsAnsweredOnTheServerAndNeverShipped(): void
    {
        $set = PublishedOptin::fromSet([[
            'id' => '01A',
            'targeting' => ['roles' => ['plan_gold']],
            'payload' => ['display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup'],
        ]]);

        $holder = new RequestContext(path: '/pricing/', isLoggedIn: true, roles: ['plan_gold']);
        $stranger = new RequestContext(path: '/pricing/', isLoggedIn: true, roles: ['subscriber']);

        $entries = Payload::forRequest($set, $holder, InstalledRules::free());

        $this->assertSame([['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']], $entries);
        $this->assertStringNotContainsString(
            'plan_gold',
            PayloadTag::render($entries, self::CAPTURE, self::BEACON, null, self::ZONE)
        );

        $this->assertSame([], Payload::forRequest($set, $stranger, InstalledRules::free()));
    }

    /**
     * `<script type="application/json">` and nothing else. Every JS optimizer
     * tested selects on `script[!type]` or `type="text/javascript"`, so this
     * tag is invisible to all of them and survives aggregation in place
     * (ADR 0004).
     */
    public function testThePayloadTravelsAsAJsonScriptTag(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']], self::CAPTURE, self::BEACON, null, self::ZONE);

        $this->assertStringStartsWith('<script type="application/json" id="wconvert-payload" ', $tag);
        $this->assertStringEndsWith("</script>\n", $tag);
        $this->assertStringContainsString('"01A"', $tag);
    }

    /**
     * The capture endpoint rides on the element rather than in the JSON: it is
     * one fact about the SITE, and repeating it per entry would pay for it as
     * many times as the page has Optins. The loader has no `wp-api-fetch` and
     * cannot compute it (ADR 0004).
     */
    public function testThePayloadCarriesWhereToPostACapture(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']], self::CAPTURE, self::BEACON, null, self::ZONE);

        $this->assertStringContainsString(sprintf('data-capture="%s"', self::CAPTURE), $tag);
        $this->assertSame(1, substr_count($tag, 'data-capture'));
    }

    /**
     * And the beacon rides beside it, for the same reason and at the same
     * cost: one fact about the site, once per page rather than once per
     * Optin. The loader cannot compute this one either, and a namespace root
     * it appended `/beacon` to would be a route name spelled in TypeScript.
     */
    public function testThePayloadCarriesWhereToPostABeacon(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']], self::CAPTURE, self::BEACON, null, self::ZONE);

        $this->assertStringContainsString(sprintf('data-beacon="%s"', self::BEACON), $tag);
        $this->assertSame(1, substr_count($tag, 'data-beacon'));
    }

    /**
     * The allowance the whole site shares rides on the element too, for the
     * two route attributes' reason: one fact about the SITE, and the JSON is a
     * list of facts about Optins.
     *
     * **It is absent until a merchant configures one**, which is every install
     * — all four fields default OFF at that scope (ADR 0047) — so the common
     * case costs the page nothing at all.
     */
    public function testThePayloadCarriesTheSiteWideAllowanceOnlyOnceThereIsOne(): void
    {
        $entries = [['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']];

        $this->assertStringNotContainsString(
            'data-allowance',
            PayloadTag::render($entries, self::CAPTURE, self::BEACON, null, self::ZONE)
        );

        $tag = PayloadTag::render(
            $entries,
            self::CAPTURE,
            self::BEACON,
            ['cooldownDays' => 3, 'stopAfterDismiss' => false],
            self::ZONE
        );

        $this->assertStringContainsString('data-allowance="', $tag);
        $this->assertSame(1, substr_count($tag, 'data-allowance'));
        $this->assertStringContainsString('cooldownDays', $tag);
    }

    /**
     * **An object, never an array.** The four fields are all optional, so an
     * allowance that turns both switches on and caps no number has an empty
     * shape — and `[]` reaches the browser as a JSON array, which
     * `payload.ts` refuses. `{}` is the same allowance the loader can read.
     */
    public function testAnAllowanceWithNoKeysStillTravelsAsAnObject(): void
    {
        $tag = PayloadTag::render(
            [['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
            self::CAPTURE,
            self::BEACON,
            [],
            self::ZONE
        );

        $this->assertStringContainsString('data-allowance="{}"', $tag);
    }

    /**
     * The attribute is escaped for an ATTRIBUTE like the two routes beside it.
     * JSON in an attribute carries double quotes on every key, so this is the
     * one that would break out on the first character if it were not.
     */
    public function testTheSiteAllowanceCannotBreakOutOfItsAttribute(): void
    {
        $tag = PayloadTag::render(
            [['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
            self::CAPTURE,
            self::BEACON,
            ['maxImpressions' => 2],
            self::ZONE
        );

        $this->assertStringContainsString('data-allowance="{&quot;maxImpressions&quot;:2}"', $tag);
        $this->assertSame(1, substr_count($tag, '</script>'));
    }

    /**
     * The site's own clock rides on the element too, for the two routes'
     * reason: one fact about the SITE, beside a list of facts about Optins.
     *
     * **It is printed always**, rather than only where an entry carries a rule
     * that reads it. A conditional here would mean PHP asking which CLIENT
     * rule types this page names, which is the one thing the three-axis split
     * exists to prevent (ADR 0005) — and the loader is where the decision
     * belongs anyway: a page with no time rule never reads the attribute.
     *
     * It is the counterpart of the allowance above it, and the pair is worth
     * reading together: both are one fact about the site, and only one of them
     * is conditional.
     */
    public function testThePayloadCarriesTheSitesOwnClock(): void
    {
        $tag = PayloadTag::render(
            [['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
            self::CAPTURE,
            self::BEACON,
            null,
            self::ZONE
        );

        $this->assertStringContainsString('data-tz="Europe/London"', $tag);
        $this->assertSame(1, substr_count($tag, 'data-tz'));
    }

    /**
     * A site with no city chosen stores a fixed offset, which is what
     * `wp_timezone()->getName()` answers there. It travels verbatim: the
     * loader reads that shape as arithmetic and never asks `Intl` about it.
     */
    public function testAFixedOffsetTravelsAsItIsStored(): void
    {
        $tag = PayloadTag::render(
            [['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
            self::CAPTURE,
            self::BEACON,
            null,
            '+05:30'
        );

        $this->assertStringContainsString('data-tz="+05:30"', $tag);
    }

    /**
     * **The two route attributes are escaped for an ATTRIBUTE**, which is the
     * other half of the claim {@see \WConvert\Frontend\LoaderEnqueue} rests on
     * when it echoes this tag without escaping it again (#60). The JSON body
     * is escaped by `JSON_HEX_TAG` below; these are not JSON, so they are
     * cleaned as URLs and escaped for the attribute by WordPress's tag API.
     *
     * A quote reaching either one unescaped closes the attribute and every
     * character after it is markup — the same failure as the one below, in the
     * one place on this tag the JSON encoder never sees.
     */
    public function testTheRouteAttributesCannotBreakOutOfTheirAttribute(): void
    {
        $tag = PayloadTag::render(
            [['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
            'https://example.com/wp-json/wconvert/v1/capture?x="><script>alert(1)</script>',
            self::BEACON,
            null,
            self::ZONE
        );

        $this->assertStringNotContainsString('<script>alert', $tag);
        $this->assertSame(1, substr_count($tag, '</script>'));
    }

    /**
     * A closing tag inside the copy must not end the script element early.
     * json_encode's JSON_HEX_TAG is what stops it, and this is the test that
     * notices the day someone drops the flag for smaller output.
     */
    public function testCopyContainingAClosingScriptTagCannotBreakOut(): void
    {
        $tag = PayloadTag::render([['id' => '01A', 'headline' => '</script><script>alert(1)</script>']], self::CAPTURE, self::BEACON, null, self::ZONE);

        $this->assertSame(1, substr_count($tag, '</script>'));
        $this->assertStringNotContainsString('<script>alert', $tag);
    }

    /**
     * No matching Optin means no tag — not an empty one. An Optin that does
     * not match the current page costs the page nothing (ADR 0003).
     */
    public function testNoMatchingOptinPrintsNothingAtAll(): void
    {
        $this->assertSame('', PayloadTag::render([], self::CAPTURE, self::BEACON, null, self::ZONE));
    }

    /**
     * A stored entry with no id cannot be beaconed against, so it is not an
     * Optin — it is a corrupted option, and dropping it is the only thing that
     * leaves the page working.
     */
    public function testAnEntryWithNoIdIsDroppedRatherThanShipped(): void
    {
        $set = PublishedOptin::fromSet([
            ['targeting' => [], 'payload' => ['display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
            ['id' => '01A', 'targeting' => [], 'payload' => ['display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
        ]);

        $this->assertSame(['01A'], array_column(Payload::forRequest($set, self::at('/'), InstalledRules::free()), 'id'));
    }

    // ========================================================================
    // THE [[Goal]] REACHES PHP AND NEVER THE BROWSER (#36).
    // ========================================================================

    /**
     * The Goal rides the published projection so the enqueue path can resolve
     * a cart Optin's CTA — and it is stripped from what the page carries,
     * because nothing that RENDERS an Optin reads it and the payload is
     * inlined into every matching page against a 2KB budget.
     */
    public function testTheGoalIsReadByPhpAndNeverShippedToTheBrowser(): void
    {
        $set = PublishedOptin::fromSet([
            ['id' => '01A', 'goal' => 'recover_cart', 'targeting' => [], 'payload' => ['display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']],
        ]);

        $this->assertSame(\WConvert\Goal\Goal::RecoverCart, $set[0]->goal);

        $entries = Payload::forRequest($set, self::at('/'), InstalledRules::withPro());

        $this->assertSame([['id' => '01A', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'display_type' => 'popup']], $entries);
        $this->assertStringNotContainsString('recover_cart', PayloadTag::render($entries, self::CAPTURE, self::BEACON, null, self::ZONE));
    }

    // ========================================================================
    // THE WAY BACK TO THE CART, RESOLVED AT ENQUEUE (ADR 0025).
    // ========================================================================

    private const CART = 'https://example.test/cart/';

    /**
     * @param array<string, mixed> $payload
     * @return list<PublishedOptin>
     */
    private static function optin(string $goal, array $payload = []): array
    {
        return PublishedOptin::fromSet([
            ['id' => '01A', 'goal' => $goal, 'targeting' => [], 'payload' => $payload + ['display_rules' => \WConvert\Rules\DisplayPlan::immediate()] + self::ctaOnly()],
        ]);
    }

    /** @return array<string, mixed> A one-step, click-metered design with an href-less CTA. */
    private static function ctaOnly(): array
    {
        return ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [
            ['type' => 'button', 'role' => 'cta_label', 'label' => 'Back to my cart', 'action' => 'link'],
        ]]]]), 'tokens' => []]];
    }

    /**
     * @param list<array<string, mixed>> $entries
     * @return mixed
     */
    private static function href(array $entries)
    {
        return $entries[0]['template']['tree']['steps'][0]['content']['children'][0]['href'] ?? null;
    }

    public function testACartOptinsCtaIsPointedAtTheSitesCart(): void
    {
        $set = self::optin('recover_cart');
        $entries = Payload::forRequest($set, self::at('/'), InstalledRules::withPro());

        $this->assertSame(self::CART, self::href(LoaderEnqueue::withCartUrl($entries, LoaderEnqueue::cartOptinsIn($set), self::CART)));
    }

    /**
     * **And no other Goal's is.** *Promote a sale or offer* ships the same
     * click-metered CTA with no href, and its destination is the merchant's:
     * a rule keyed on the shape of the button rather than on the Goal would
     * silently send an unconfigured sale Optin to the cart.
     */
    public function testAClickMeteredOptinUnderAnotherGoalIsLeftAlone(): void
    {
        $set = self::optin('promote_offer');
        $entries = Payload::forRequest($set, self::at('/'), InstalledRules::withPro());

        $this->assertNull(self::href(LoaderEnqueue::withCartUrl($entries, LoaderEnqueue::cartOptinsIn($set), self::CART)));
    }

    /**
     * An entry nothing was done to comes back byte-identical, so a page with
     * no cart Optin on it pays nothing for this at all.
     */
    public function testAPageWithNoCartOptinIsUntouched(): void
    {
        $set = self::optin('grow_email_list');
        $entries = Payload::forRequest($set, self::at('/'), InstalledRules::withPro());

        $this->assertSame($entries, LoaderEnqueue::withCartUrl($entries, LoaderEnqueue::cartOptinsIn($set), self::CART));
    }

    private static function at(string $path): RequestContext
    {
        return new RequestContext(path: $path);
    }
}
