<?php

/**
 * pot-call-sites.php — every gettext call site in the PHP files named on stdin,
 * as JSON, for bin/pot-coverage.mjs.
 *
 *   printf '%s\n' src/Foo.php pro/src/Bar.php | php bin/pot-call-sites.php
 *
 * Prints `[{"file","line","fn","msgid","plural","context","domain"}, …]`, where
 * a part that is not a single string literal is null (see
 * bin/gettext-calls.php for what counts). Exits 2 when a named file cannot
 * be read: "could not read" is not "has no calls".
 *
 * It is the PHP half of the POT-coverage check because PHP's own tokenizer is
 * the only reader that knows a comment from a call; the JS/TS half is read with
 * the TypeScript parser in pot-coverage.mjs. Both take their function table from
 * bin/gettext-functions.json.
 */

require_once __DIR__ . '/gettext-calls.php';

$sites = [];

foreach (preg_split('/\R/', (string) stream_get_contents(STDIN)) ?: [] as $file) {
    $file = trim($file);
    if ($file === '') {
        continue;
    }

    $code = @file_get_contents($file);
    if ($code === false) {
        fwrite(STDERR, "pot-call-sites: cannot read $file\n");
        exit(2);
    }

    foreach (wconvert_php_gettext_calls($code) as $call) {
        $sites[] = [
            'file'    => $file,
            'line'    => $call['line'],
            'fn'      => $call['fn'],
            'msgid'   => $call['args']['msgid'] ?? null,
            'plural'  => $call['args']['plural'] ?? null,
            'context' => $call['args']['context'] ?? null,
            'domain'  => $call['args']['domain'] ?? null,
        ];
    }
}

echo json_encode($sites, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), "\n";
