<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\CartLink;

/**
 * The way back to the cart is **renderer-resolved**, from
 * `wc_get_cart_url()`, at the moment the page is drawn (ADR 0025).
 *
 * A [[Playbook]] can express nothing site-local, and the cart page is a page
 * on one particular site — so the words are the Playbook's and the destination
 * is the site's, exactly as the privacy-policy link splits one file over
 * ({@see \WConvert\Tests\Unit\Template\PolicyLinkTest}).
 *
 * **The settings-panel override is a merchant's href winning**, which is the
 * absence of a special case rather than a branch: a `button` declares `href`
 * as content, so the panel already draws a control for it, and this fills in
 * only where nobody has.
 */
#[CoversClass(CartLink::class)]
final class CartLinkTest extends TestCase
{
    private const CART = 'https://example.test/cart/';

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function payload(array $overrides = []): array
    {
        $button = array_merge(['type' => 'button', 'role' => 'cta_label', 'label' => 'Back to my cart', 'action' => 'link'], $overrides);

        return ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [
            ['type' => 'heading', 'role' => 'headline', 'text' => 'Leaving something behind?'],
            $button,
        ]]]]), 'tokens' => []]];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function cta(array $payload): array
    {
        /** @var array<string, mixed> $node */
        $node = $payload['template']['tree']['steps'][0]['content']['children'][1];

        return $node;
    }

    public function testAnHreflessCtaTakesTheSitesCartUrl(): void
    {
        $this->assertSame(self::CART, self::cta(CartLink::into(self::payload(), self::CART))['href']);
    }

    /**
     * **The override.** A merchant who typed a destination has named one, and
     * a site-resolved default that overwrote it would silently redirect an
     * Optin they configured by hand.
     */
    public function testAMerchantsOwnHrefIsNeverOverwritten(): void
    {
        $theirs = 'https://example.test/basket/';

        $this->assertSame($theirs, self::cta(CartLink::into(self::payload(['href' => $theirs]), self::CART))['href']);
    }

    /**
     * **A cleared control means "use the site's"**, not "no destination".
     * Emptiness is judged the way a form field is — an absent key and an empty
     * string both mean nothing was chosen — which is the reading the rule
     * vocabulary already takes one axis over. The panel deletes the key on
     * clear, so this is the hand-written and imported case.
     */
    public function testAnEmptyHrefIsAClearedControlAndNotADestination(): void
    {
        $this->assertSame(self::CART, self::cta(CartLink::into(self::payload(['href' => '']), self::CART))['href']);
    }

    /**
     * With no store there is no cart URL, and none is invented — never a dead
     * `#`. Such an Optin is [[Suspended]] anyway, because both cart
     * [[Condition]]s carry `on_absence: suspend` and neither is supplied
     * without a store, so this is the belt beside that brace.
     */
    public function testWithNoStoreTheCtaStaysHrefless(): void
    {
        foreach ([null, ''] as $none) {
            $this->assertArrayNotHasKey('href', self::cta(CartLink::into(self::payload(), $none)));
        }
    }

    /**
     * **A submit button is not a CTA.** The converting act is read from the
     * same `action` key {@see \WConvert\Template\ConvertingAct} reads, so the
     * three cannot disagree about which node converts — and a cart Optin has
     * no form anyway, so a submit button here is a design that should never
     * have registered.
     */
    public function testASubmitButtonIsLeftAlone(): void
    {
        $resolved = CartLink::into(self::payload(['action' => 'submit']), self::CART);

        $this->assertArrayNotHasKey('href', self::cta($resolved));
    }

    /**
     * A button with no `action` at all defaults to SUBMIT, which is the same
     * default the renderer takes — `action !== 'link'` is a submit there. A
     * second reading here would put a cart URL on a form's submit button.
     */
    public function testAButtonWithNoActionIsASubmitAndIsLeftAlone(): void
    {
        $payload = self::payload();

        unset($payload['template']['tree']['steps'][0]['content']['children'][1]['action']);

        $this->assertArrayNotHasKey('href', self::cta(CartLink::into($payload, self::CART)));
    }

    /**
     * The walk covers both panes of a `split`, which is exactly where a second
     * reader forgets to look — the same argument
     * {@see \WConvert\Template\ConvertingAct::offeredIn()} makes on the other
     * side of the boundary.
     */
    public function testItReachesACtaInTheFarPaneOfASplit(): void
    {
        $payload = ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'split',
            'start' => [['type' => 'image', 'src' => 'x.png']],
            'end' => [['type' => 'button', 'action' => 'link', 'label' => 'Back']],
        ]]]), 'tokens' => []]];

        $resolved = CartLink::into($payload, self::CART);

        $this->assertSame(self::CART, $resolved['template']['tree']['steps'][0]['content']['end'][0]['href']);
    }

    /**
     * A payload with no template — an Optin whose snapshot is missing or
     * malformed — comes back untouched rather than throwing. One Optin not
     * rendered is never a fatal on a page WConvert was asked to leave alone
     * (ADR 0004).
     */
    public function testAPayloadWithNoTemplateComesBackUnchanged(): void
    {
        foreach ([[], ['template' => null], ['template' => ['tree' => 'nonsense']]] as $payload) {
            $this->assertSame($payload, CartLink::into($payload, self::CART));
        }
    }

    /**
     * **An entry nothing was done to comes back byte-identical**, which
     * matters because the payload is inlined into every matching page against
     * a 2KB budget and re-keying a tree would spend bytes on nothing.
     */
    public function testAnEntryWithNothingToResolveIsUnchanged(): void
    {
        $payload = self::payload(['href' => 'https://example.test/basket/']);

        $this->assertSame($payload, CartLink::into($payload, self::CART));
    }
}
