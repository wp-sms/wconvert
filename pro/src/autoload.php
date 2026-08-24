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
| Pro has no third-party PHP dependencies, so PSR-4 is the whole job. Both
| Pro's plugin file and tests/bootstrap.php require THIS file, so there is one
| definition of where Pro's classes live.
*/

spl_autoload_register(static function (string $class): void {
    $prefix = 'WConvert\\Pro\\';
    $length = strlen($prefix);

    if (strncmp($class, $prefix, $length) !== 0) {
        return;
    }

    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, $length)) . '.php';

    if (is_file($file)) {
        require $file;
    }
});
