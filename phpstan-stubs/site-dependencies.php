<?php

/**
 * Classes WConvert asks about but never calls — **stubs for static analysis
 * only, never loaded at runtime.**
 *
 * `WConvert\Support\WpSitePresence` answers [[Availability]] by asking whether
 * another plugin's class is loaded. PHPStan cannot see either class, and
 * `class_exists($unknown, false)` reads to it as permanently false — so
 * without this it reports the one honest way of asking the question as
 * impossible.
 *
 * Referenced from `phpstan.neon.dist` under `scanFiles`, which reads symbols
 * and never executes them. Nothing requires this file, it is outside the PSR-4
 * map, and it ships in no artifact.
 *
 * Declarations are kept to the SURFACE WCONVERT ACTUALLY TOUCHES, and no
 * wider. For most of what is here the question is only ever "is this loaded",
 * so the declaration is empty; three exceptions earn a body, and each of them
 * is a call WConvert really makes:
 *
 * - WSMS's container accessor, which the WSMS [[Destination]] reaches and
 *   which `WpWsmsContacts` resolves by name for exactly the reason this file
 *   exists.
 * - MailPoet's two static entry points, for the same reason one file over.
 *   Both return `mixed`, deliberately: everything past them is reached
 *   through `WpMailPoetSubscribers::call()` on a variable method name, which
 *   is the honest position when the classes that would be checked are not on
 *   the machine running the analyser. Stubbing MailPoet's signatures here
 *   would be maintaining a fiction of them beside the real ones.
 * - WooCommerce's cart, which `WConvert\Pro\Module\CartRecovery\CartCookie` reads two
 *   numbers off — a count and a total, never contents (ADR 0025).
 * - `wc_get_cart_url()` and `wc_setcookie()`, the two functions that half of
 *   the cart [[Goal]] runs on: one resolves the CTA's destination at render
 *   time, the other puts the cart on the visitor's device.
 *
 * A stub is not a dependency. Both call sites are guarded by
 * `function_exists()` at runtime, because free ships on installs with no store
 * at all — PHPStan simply cannot see that a plugin it was not given declares
 * them.
 */

namespace {
    if (!class_exists('WooCommerce')) {
        /**
         * WooCommerce's own container, which `WC()` hands back.
         *
         * `$cart` is nullable and that is not defensiveness: a request that
         * never loaded a cart — an admin screen, a cron run, a REST call —
         * genuinely has none, and it is the case the cookie writer must
         * survive without clearing a live shopper's cookie.
         */
        class WooCommerce
        {
            public ?WC_Cart $cart = null;
            public ?WC_Session_Handler $session = null;
        }
    }

    if (!class_exists('WC_Cart')) {
        class WC_Cart
        {
            /** @return array<string, array<string, mixed>> */
            public function get_cart(): array { return []; }
            public function get_cart_contents_count(): int
            {
                return 0;
            }

            /** @return float|string WooCommerce returns a formatted string for the `view` context. */
            public function get_total(string $context = 'view')
            {
                return 0.0;
            }
        }
    }

    if (!class_exists('WC_Session_Handler')) {
        class WC_Session_Handler {
            public function set_customer_session_cookie(bool $set): void {}
            public function set(string $key, mixed $value): void {}
            public function get(string $key): mixed { return null; }
            public function __unset(string $key): void {}
            public function save_data(): void {}
        }
    }
    if (!class_exists('WC_Order')) {
        class WC_Order {
            public function get_id(): int { return 0; }
            public function get_meta(string $key): mixed { return null; }
            public function update_meta_data(string $key, mixed $value): void {}
            public function delete_meta_data(string $key): void {}
            public function save(): int { return 0; }
            public function get_date_paid(): ?\DateTime { return null; }
            public function get_date_created(): ?\DateTime { return null; }
            public function get_currency(): string { return ''; }
            public function get_status(): string { return ''; }
            public function get_edit_order_url(): string { return ''; }
            /** @param string|list<string> $types
             * @return array<int, WC_Order_Item> */
            public function get_items(string|array $types = 'line_item'): array { return []; }
            /** @return list<WC_Order_Refund> */
            public function get_refunds(): array { return []; }
        }
        class WC_Order_Refund extends WC_Order { public function get_amount(): string { return ''; } }
        class WC_Order_Item {
            public function get_type(): string { return ''; }
            public function get_total(): string { return ''; }
            public function get_total_tax(): string { return ''; }
        }
    }
    if (!function_exists('wc_get_orders')) {
        /** @param array<string, mixed> $args
         * @return list<WC_Order> */
        function wc_get_orders(array $args): array { return []; }
        /** @return list<string> */
        function wc_get_is_paid_statuses(): array { return []; }
        function wc_load_cart(): void {}
    }

    if (!class_exists('WC_AJAX')) {
        class WC_AJAX { public static function get_endpoint(string $request = ''): string { return ''; } }
    }
    if (!class_exists('WC_Product')) {
        class WC_Product {
            public function get_status(): string { return ''; }
            public function get_name(): string { return ''; }
            public function get_parent_id(): int { return 0; }
            /** @return list<int> */
            public function get_cross_sell_ids(): array { return []; }
            public function get_permalink(): string { return ''; }
            public function get_price_html(): string { return ''; }
            public function get_image_id(): int { return 0; }
            /** @param string|list<string> $type */
            public function is_type(string|array $type): bool { return false; }
            public function is_visible(): bool { return false; }
            public function is_purchasable(): bool { return false; }
            public function is_in_stock(): bool { return false; }
        }
    }
    if (!function_exists('wc_get_product')) {
        function wc_get_product(int $id): WC_Product|false { return false; }
    }
    if (!function_exists('get_woocommerce_currency')) {
        function get_woocommerce_currency(): string { return ''; }
        function wc_get_price_decimals(): int { return 2; }
    }
    if (!function_exists('wc_get_page_id')) {
        function wc_get_page_id(string $page): int { return -1; }
    }

    if (!function_exists('WC')) {
        function WC(): WooCommerce
        {
            return new WooCommerce();
        }
    }

    if (!function_exists('wc_get_cart_url')) {
        function wc_get_cart_url(): string
        {
            return '';
        }
    }

    if (!function_exists('wc_setcookie')) {
        function wc_setcookie(
            string $name,
            string $value,
            int $expire = 0,
            bool $secure = false,
            bool $httponly = false
        ): void {
        }
    }
}

namespace WSms {
    if (!class_exists('WSms\\Bootstrap')) {
        class Bootstrap
        {
            /**
             * @return mixed
             */
            public static function get(string $id)
            {
                return null;
            }
        }
    }
}

namespace WSms\Exception {
    if (!class_exists('WSms\\Exception\\ConflictException')) {
        class ConflictException extends \RuntimeException
        {
        }
    }
}

namespace MailPoet\DI {
    if (!class_exists('MailPoet\\DI\\ContainerWrapper')) {
        class ContainerWrapper
        {
            /**
             * @return mixed
             */
            public static function getInstance()
            {
                return null;
            }
        }
    }
}

namespace MailPoet\API {
    if (!class_exists('MailPoet\\API\\API')) {
        class API
        {
            /**
             * @return mixed
             */
            public static function MP(string $version)
            {
                return null;
            }
        }
    }
}
