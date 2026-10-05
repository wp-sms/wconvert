<?php
namespace WConvert\Tests\Unit\Pro\CartRecovery;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\CartRecovery\RecommendationContext;

final class RecommendationContextTest extends TestCase
{
    public function test_product_page_works_with_an_empty_known_basket_but_not_another_page_or_unknown_cart(): void
    {
        $node = ['context' => 'product', 'main_product_id' => 10];
        self::assertSame('', RecommendationContext::reason($node, ['quantity' => 0, 'products' => []], 10));
        self::assertSame('different_product', RecommendationContext::reason($node, ['quantity' => 0, 'products' => []], 20));
        self::assertSame('unknown', RecommendationContext::reason($node, null, 10));
        self::assertSame('main_required', RecommendationContext::reason(['context' => 'product'], ['quantity' => 0, 'products' => []], 10));
    }

    public function test_old_campaigns_keep_nonempty_requirement_and_main_product_narrows_the_basket(): void
    {
        $cart = ['quantity' => 2, 'products' => [10, 11]];
        self::assertSame('empty', RecommendationContext::reason([], ['quantity' => 0, 'products' => []], 10));
        self::assertSame('', RecommendationContext::reason([], $cart, 0));
        self::assertSame('', RecommendationContext::reason(['main_product_id' => 10], $cart, 0));
        self::assertSame('different_basket', RecommendationContext::reason(['main_product_id' => 20], $cart, 20));
        self::assertSame('main_required', RecommendationContext::reason(['main_product_id' => 0], $cart, 10));
    }

    public function test_pairing_source_uses_only_the_chosen_main_product_even_with_other_basket_items(): void
    {
        $cart = ['quantity' => 2, 'products' => [10, 11, 20]];
        self::assertSame([10], RecommendationContext::seeds(['main_product_id' => 10], $cart));
        self::assertSame($cart['products'], RecommendationContext::seeds([], $cart));
        self::assertCount(100, RecommendationContext::seeds([], ['products' => range(1, 200)]));
    }
}
