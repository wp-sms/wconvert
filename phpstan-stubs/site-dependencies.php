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
 * Deliberately EMPTY declarations: the question is only ever "is this loaded",
 * so a fuller stub would describe an API WConvert does not use — except for
 * WSMS's container accessor, which the WSMS [[Destination]] does reach and
 * which `WpSmsContacts` resolves by name for exactly the reason this file
 * exists.
 */

namespace {
    if (!class_exists('WooCommerce')) {
        class WooCommerce
        {
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
