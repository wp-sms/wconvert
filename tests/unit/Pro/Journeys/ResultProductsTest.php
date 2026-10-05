<?php

namespace WConvert\Tests\Unit\Pro\Journeys;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\Journeys\ResultProducts;

/** The product side of a quiz result lives in Pro's journeys module (ADR 0127). */
final class ResultProductsTest extends TestCase
{
    /** @param array<string, mixed> $result
     * @return array<string, mixed> */
    private static function entry(array $result): array
    {
        return ['id' => 'quiz', 'template' => ['tree' => ['steps' => [['kind' => 'result', 'results' => [$result]]]]]];
    }

    public function testOnlyACategoryResultNamesTheMatchesRoute(): void
    {
        $base = ['data-beacon' => 'x'];
        self::assertSame($base, ResultProducts::attributes($base, [self::entry(['id' => 'a', 'product_ids' => [1]])]));
        $with = ResultProducts::attributes($base, [self::entry(['id' => 'a', 'product_filter' => ['category_id' => 3, 'attributes' => []]])]);
        self::assertSame('https://example.test/wp-json/wconvert/v1/product-matches', $with['data-product-matches']);
    }

    public function testAnswersOnlyAQuizResultNothingElseAnswered(): void
    {
        $answered = ['state' => 'ok', 'message' => 'Cart-recovery answered.'];
        $cart = ['id' => 'a', 'product_action' => 'add_to_cart', 'product_ids' => [1]];
        self::assertSame($answered, ResultProducts::check($answered, $cart, 'result'), 'cart-recovery, at priority 10, wins');
        self::assertNull(ResultProducts::check(null, ['type' => 'products'], 'recommendations'), 'recommendations are not this module\'s');
        self::assertSame('unknown', ResultProducts::check(null, $cart, 'result')['state'], 'no catalog read for a cart button it cannot check');
    }
}
