<?php

if (!defined('ABSPATH')) exit;

// Copied to packages/autoload.php when the ZIP is built (see bin/build.sh). WConvert has no third-party runtime
// package that needs prefixing — Action Scheduler is a shared library and is loaded by path from wconvert.php — so
// a PSR-4 loader for src/ is all it needs. wp-scoper writes a richer file when a package is added to
// `extra.wp-scoper.packages`, and that file wins because it is already there.
spl_autoload_register(static function (string $class): void {
    if (strpos($class, 'WConvert\\') !== 0) {
        return;
    }

    $path = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, 9)) . '.php';

    if (is_file($path)) {
        require $path;
    }
});
