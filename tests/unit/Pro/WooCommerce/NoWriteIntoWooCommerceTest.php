<?php

namespace WConvert\Tests\Unit\Pro\WooCommerce;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\PhpSource;

/**
 * **No code path creates orders/coupons or mutates a shopper's cart**
 * (ADR 0025).
 *
 * WConvert reads the cart and writes a cookie. That is the entire traffic
 * between the two, and every tempting extension of it is a write:
 *
 * - **Minting a coupon per recovery**, which WSMS's own cart module does. It
 *   is not merely unwise here, it is impossible: the payload is baked into
 *   HTML a full-page cache serves **byte-identically to every visitor**
 *   (ADR 0003, ADR 0004), so only a static shared code could ever appear — and
 *   a static code the merchant already created in WooCommerce is just words
 *   they type into the copy. Minting one would also be a `shop_coupon` post,
 *   which is ADR 0024's error in a different table.
 * - **Touching the cart itself** — restoring it, re-adding an item, applying a
 *   code. An Optin is a display, and a display that edits a shopper's cart is
 *   a shopper who finds things in it they did not put there.
 * ADR 0119 permits only campaign provenance in the existing session and order
 * metadata. That optional tracking does not change products, payment or cart.
 *
 * A test rather than a paragraph, for the reason
 * {@see \WConvert\Tests\Unit\Destination\NoEngagementIsEverWrittenTest} is
 * one: no assertion about output can see a rule that is currently being kept,
 * and the failure this guards against is a line somebody ADDS.
 *
 * Tokenised rather than grepped, because this file, ADR 0025 and the cookie
 * writer's own header all DISCUSS coupon minting at length — and a check that
 * flags the prose explaining itself earns an exception list, which is the one
 * thing it must never acquire.
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

    public function testNeitherTreeMutatesCartOrCreatesOrdersAndCoupons(): void
    {
        $offenders = [];

        foreach (self::phpFiles() as $file) {
            $code = PhpSource::code($file);

            foreach (self::WRITES as $write) {
                if (str_contains($code, $write)) {
                    $offenders[] = sprintf('%s names %s', $file, $write);
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "WConvert reads WooCommerce and writes a cookie. A feature that genuinely needs to change\n"
                . "a shopper's cart or mint them a code is a signal to re-read ADR 0025, not a signal to\n"
                . "add the call.\n" . implode("\n", $offenders)
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
