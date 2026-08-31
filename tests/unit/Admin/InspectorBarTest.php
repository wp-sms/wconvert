<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\InspectorBar;
use WConvert\Frontend\InspectorEnqueue;
use WConvert\Rest\Routes;
use WP_Admin_Bar;

/**
 * The door into the eligibility inspector, on the page it explains.
 *
 * The link is the shortest path there is to the answer: the inspector runs on
 * the REAL request, so the merchant wondering why nothing appeared is already
 * standing on the page they need it for (ADR 0048). What is asserted here is
 * the two ways that link can be wrong — offered to somebody who may not have
 * it, and offered where clicking it would do nothing.
 */
#[CoversClass(InspectorBar::class)]
final class InspectorBarTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [Routes::MANAGE_CAPABILITY];
        $GLOBALS['wconvertTestIsAdmin'] = false;
        $GLOBALS['wconvertTestQuery'] = ['home_url' => 'https://example.test'];
        $_SERVER['REQUEST_URI'] = '/pricing';

        unset($_GET[InspectorEnqueue::PARAM]);
    }

    protected function tearDown(): void
    {
        unset($_GET[InspectorEnqueue::PARAM], $_SERVER['REQUEST_URI']);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function nodes(): array
    {
        $bar = new WP_Admin_Bar();

        (new InspectorBar())->node($bar);

        return $bar->nodes;
    }

    public function testItOffersTheCurrentPageWithTheParameterOn(): void
    {
        $nodes = $this->nodes();

        $this->assertCount(1, $nodes);
        $this->assertSame('https://example.test/pricing?wconvert-inspect=1', $nodes[0]['href']);
    }

    /**
     * **The same capability the panel itself is gated on**, so the link and
     * the thing it links to can never come to disagree about who may have it.
     * A subscriber is the case that matters: they are logged in, and a gate
     * written as "is anybody signed in" would pass.
     */
    public function testItIsNotOfferedToSomebodyWhoCouldNotUseIt(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['read'];

        $this->assertSame([], $this->nodes());
    }

    /**
     * **Absent once the inspector is already on.** A link that adds a
     * parameter the URL already carries does nothing, and a merchant who
     * clicked it and saw no change would reasonably conclude the feature is
     * broken.
     */
    public function testItIsNotOfferedOnAPageThatAlreadyHasIt(): void
    {
        $_GET[InspectorEnqueue::PARAM] = '1';

        $this->assertSame([], $this->nodes());
    }

    /**
     * In wp-admin there is no page to inspect, and {@see InspectorEnqueue}
     * returns on `is_admin()` — a node there would link to a URL that renders
     * no panel.
     */
    public function testItIsNotOfferedInsideWpAdmin(): void
    {
        $GLOBALS['wconvertTestIsAdmin'] = true;

        $this->assertSame([], $this->nodes());
    }

    /**
     * **A page with a query string keeps it.** A merchant asking about
     * `/shop?filter=sale` is asking about that page, and half the real
     * Targeting tickets are about pages that only exist with their query on.
     */
    public function testItKeepsTheQueryStringOfThePageItIsOffering(): void
    {
        $_SERVER['REQUEST_URI'] = '/shop?filter=sale';

        $this->assertSame(
            'https://example.test/shop?filter=sale&wconvert-inspect=1',
            $this->nodes()[0]['href']
        );
    }
}
