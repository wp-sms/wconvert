<?php

namespace WConvert\Tests\Unit\Pro\WooCommerce;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\PhpSource;

/**
 * Orders and coupons remain external. ADR 0121 permits quantity-one cart additions
 * and session persistence only in the protected recommendation transport.
 * The scanner distinguishes action identifiers from executable cart method calls.
 */
#[CoversNothing]
final class NoWriteIntoWooCommerceTest extends TestCase
{
    /**
     * How a write into WooCommerce gets spelled in code.
     *
     * Cart mutators are named as bare methods because that is how they are
     * reached — `WC()->cart->add_to_cart(...)` — and the post type and the
     * coupon class are named because minting is the specific temptation
     * ADR 0025 argues against by name.
     */
    private const WRITES = [
        'shop_coupon',
        'WC_Coupon',
        'wc_create_order',
        'add_to_cart',
        'remove_cart_item',
        'empty_cart',
        'apply_coupon',
        'set_quantity',
        'set_session',
    ];

    public function testOnlyGuardedRecommendationTransportMayAddAndSaveCart(): void
    {
        $offenders = [];

        foreach (self::phpFiles() as $file) {
            $code = PhpSource::code($file);

            foreach (self::WRITES as $write) {
                // ADR 0121 permits two cart methods in exactly one guarded transport.
                if (in_array($write, ['add_to_cart', 'set_session'], true)) {
                    if (str_ends_with($file, '/pro/modules/cart-recovery/src/CartAddition.php')) continue;
                    if (!preg_match('/->\s*' . $write . '\s*\(/', $code)) continue;
                }
                if (str_contains($code, $write)) {
                    $offenders[] = sprintf('%s names %s', $file, $write);
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "WooCommerce writes must respect the narrow ADR 0121 cart-addition boundary.\n" . implode("\n", $offenders)
        );
    }

    /**
     * @return list<string>
     */
    private static function phpFiles(): array
    {
        $root = dirname(__DIR__, 4);
        $files = [];

        foreach (['src', 'pro/src', 'pro/modules', 'bin'] as $tree) {
            /** @var \SplFileInfo $file */
            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root . '/' . $tree)) as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $files[] = $file->getPathname();
                }
            }
        }

        // A tree that has moved leaves this scan looking at nothing, which
        // reads as clean. It is not.
        self::assertNotEmpty($files, 'nothing was inspected, so nothing is proven');

        return $files;
    }
}
