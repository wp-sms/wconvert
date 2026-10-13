<?php

defined('ABSPATH') || exit;

/*
|--------------------------------------------------------------------------
| Pro's autoloader
|--------------------------------------------------------------------------
| Pro ships as its own plugin directory and carries its own PSR-4 autoloader
| rather than riding on free's Composer map. Two reasons, and both are the
| point of the split:
|
| 1. Free's shipped autoloader must not name WConvert\Pro at all. A composer
|    autoload entry pointing at a directory the free ZIP does not contain is
|    a premium reference inside the free artifact — the exact thing ADR 0029
|    asserts is absent.
|
| 2. Pro is installed at wp-content/plugins/wconvert-pro/, a sibling of free
|    rather than a subdirectory, so free's vendor/ is not on a path Pro can
|    rely on.
|
| Pro has ONE third-party PHP dependency, the licence SDK
| (veronalabs/wp-premium-sdk, ADR 0143), and it is not loaded through Composer
| either: wp-scoper copies it under packages/ with its namespace prefixed to
| WConvert\Pro\Deps, so another plugin's copy of the same SDK at another
| version can never be the one that answers. packages/autoload.php is that
| copy's classmap; it is required below, unconditionally — a Pro without it is
| a broken build, and bin/verify-artifact-contract.sh refuses to zip one.
| Everything else is PSR-4. Both Pro's plugin file and tests/bootstrap.php
| require THIS file, so there is one definition of where Pro's classes live.
|
| THERE ARE TWO ROOTS, BECAUSE A MODULE IS A DIRECTORY (ADR 0056).
|
|   WConvert\Pro\X                    → pro/src/X.php
|   WConvert\Pro\Module\CartRecovery\X → pro/modules/cart-recovery/src/X.php
|
| Everything under pro/modules/<slug>/ is that module and nothing outside it
| is, which is what lets the artifact contract check a module by checking a
| directory. The price is this second rule: a module's PHP
| cannot live under pro/src/ without leaving the module, so the namespace
| carries the module name and this maps it back to the directory.
|
| A CLASS THAT IS NOT THERE IS NOT AN ERROR HERE, and that is the whole point
| of the shape. A build without pro/modules/cart-recovery/ has no CartCookie,
| so `class_exists(CartCookie::class)` is false on it — which is
| enforcement-by-non-registration read from the file system exactly as
| ADR 0015 describes it, rather than a tier test somebody wrote.
*/

spl_autoload_register(static function (string $class): void {
    $prefix = 'WConvert\\Pro\\';
    $length = strlen($prefix);

    if (strncmp($class, $prefix, $length) !== 0) {
        return;
    }

    $relative = substr($class, $length);
    $modulePrefix = 'Module\\';

    if (strncmp($relative, $modulePrefix, strlen($modulePrefix)) === 0) {
        $segments = explode('\\', substr($relative, strlen($modulePrefix)));
        $module = array_shift($segments);

        if ($module === null || $segments === []) {
            return;
        }

        // `CartRecovery` is the directory `cart-recovery`. Derived rather than
        // declared, so a module's namespace and its directory cannot drift —
        // and the slug in its own module.json is what a running install reads
        // (WConvert\Support\WpProPresence), so all three are one name.
        $slug = strtolower((string) preg_replace('/(?<!^)[A-Z]/', '-$0', $module));

        $file = dirname(__DIR__) . '/modules/' . $slug . '/src/' . implode('/', $segments) . '.php';
    } else {
        $file = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    }

    if (is_file($file)) {
        require $file;
    }
});

require_once dirname(__DIR__) . '/packages/autoload.php';
