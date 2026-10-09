<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Playbook\OfferLinks;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * A fresh setup's link buttons start somewhere real on this site, marked for
 * the merchant to check (ADR 0133).
 */
#[CoversClass(OfferLinks::class)]
#[CoversClass(Prefill::class)]
final class OfferLinksTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../..';

    public function testEveryLinkButtonIsPointedAtThePageAndRecorded(): void
    {
        $tree = ['steps' => [['content' => ['type' => 'stack', 'children' => [
            ['type' => 'button', 'id' => 'n1', 'action' => 'link', 'href' => '/sale/'],
            ['type' => 'button', 'id' => 'n2', 'action' => 'link'],
            ['type' => 'button', 'id' => 'n3', 'action' => 'submit'],
        ]]]]];

        [$filled, $unchecked] = OfferLinks::filled($tree, 'https://shop.test/shop/', 'shop');
        $buttons = $filled['steps'][0]['content']['children'];

        $this->assertSame(['https://shop.test/shop/', 'https://shop.test/shop/'], [$buttons[0]['href'], $buttons[1]['href']]);
        $this->assertArrayNotHasKey('href', $buttons[2], 'a button that goes nowhere takes no address');
        $this->assertSame([
            'n1' => ['href' => 'https://shop.test/shop/', 'place' => 'shop'],
            'n2' => ['href' => 'https://shop.test/shop/', 'place' => 'shop'],
        ], $unchecked);
    }

    /** Without WooCommerce, the one page every site has. */
    public function testASiteWithNoShopUsesItsHomePage(): void
    {
        $this->assertSame(['href' => home_url('/'), 'place' => 'home'], OfferLinks::onThisSite());
    }

    public function testPrefillFillsOfferLinksAndLeavesCartRecoveryAlone(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::ROOT);
        $templates = TemplateLibrary::fromDirectory($vocabulary, self::ROOT);
        $playbooks = PlaybookLibrary::fromDirectory($templates, $vocabulary, RuleVocabulary::fromManifest(self::ROOT), self::ROOT);
        $prefill = new Prefill($playbooks, $templates, $vocabulary, InstalledRules::withPro(), null,
            static fn (): array => ['href' => 'https://shop.test/shop/', 'place' => 'shop']);

        $offer = $prefill->fromPlaybook('sale-announcement');
        $this->assertNotNull($offer);
        $this->assertNotEmpty($offer['config']['unchecked_links']);
        foreach ($offer['config']['unchecked_links'] as $entry) {
            $this->assertSame(['href' => 'https://shop.test/shop/', 'place' => 'shop'], $entry);
        }

        foreach ($playbooks->all() as $playbook) {
            if ($playbook->goal !== \WConvert\Goal\Goal::RecoverCart) continue;
            $cart = $prefill->fromPlaybook($playbook->id);
            $this->assertNotNull($cart);
            $this->assertArrayNotHasKey('unchecked_links', $cart['config'], "{$playbook->id}: the renderer resolves the cart link");
        }
    }
}
