<?php
namespace WConvert\Tests\Unit\Pro\CartRecovery;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\CartRecovery\CartRules;
final class CartRulesTest extends TestCase
{
    /** @return array{quantity: int, total: float, amount: int, currency: string, decimals: int, products: list<int>, categories: list<int>, ancestors: list<int>} */
    private function cart(): array { return ['quantity' => 2, 'total' => 110.0, 'amount' => 10000, 'currency' => 'USD', 'decimals' => 2, 'products' => [10, 11], 'categories' => [5], 'ancestors' => [5, 2]]; }
    public function test_unknown_and_deleted_references_never_match_negative_rules(): void {
        $rule = ['type' => 'cart_products', 'ids' => [20], 'operator' => 'none'];
        self::assertFalse(CartRules::matches($rule, null, [20]));
        self::assertFalse(CartRules::matches($rule, $this->cart(), []));
        self::assertTrue(CartRules::matches($rule, $this->cart(), [20]));
    }
    public function test_variations_and_explicit_category_ancestry(): void {
        self::assertTrue(CartRules::matches(['type' => 'cart_products', 'ids' => [10, 11], 'operator' => 'all'], $this->cart(), [10, 11]));
        $rule = ['type' => 'cart_categories', 'ids' => [2], 'operator' => 'any', 'descendants' => true];
        self::assertTrue(CartRules::matches($rule, $this->cart(), [2]));
        $rule['descendants'] = false;
        self::assertFalse(CartRules::matches($rule, $this->cart(), [2]));
    }
    public function test_money_uses_minor_units_and_currency_and_inclusive_bounds(): void {
        $rule = ['type' => 'cart_amount', 'range' => ['operator' => 'between', 'min' => 100, 'max' => 100, 'currency' => 'USD', 'decimals' => 2]];
        self::assertTrue(CartRules::matches($rule, $this->cart()));
        $rule['range']['currency'] = 'EUR';
        self::assertFalse(CartRules::matches($rule, $this->cart()));
        $rule['range']['min'] = 1.001;
        self::assertFalse(CartRules::valid($rule));
    }
    public function test_inverted_ranges_and_fractional_quantities_are_invalid(): void {
        self::assertFalse(CartRules::valid(['type' => 'cart_quantity', 'range' => ['operator' => 'between', 'min' => 3, 'max' => 2]]));
        self::assertFalse(CartRules::valid(['type' => 'cart_quantity', 'range' => ['operator' => 'min', 'min' => 1.5]]));
        self::assertTrue(CartRules::matches(['type' => 'cart_quantity', 'range' => ['operator' => 'max', 'min' => 2]], $this->cart()));
    }
}
