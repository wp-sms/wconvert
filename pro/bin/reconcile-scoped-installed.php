<?php
/**
 * Reconcile vendor/composer/installed.json after wp-scoper runs.
 *
 * wp-scoper (delete_vendor_packages: true) copies the scoped source packages
 * into packages/ and then deletes the originals from vendor/, but it never
 * removes them from Composer's install record (vendor/composer/installed.json).
 *
 * Composer regenerates its autoloader from that record on the next
 * `composer install` *and* whenever it runs a script (`composer dist` →
 * `composer run-script`). With the files gone it warns on classmap dirs and —
 * for packages with a `files` autoload entry such as thecodingmachine/safe
 * (deprecated/apc.php) — fatals outright:
 *
 *   require(.../thecodingmachine/safe/deprecated/apc.php): Failed to open stream
 *
 * Dropping the install record for any package whose vendor directory no longer
 * exists keeps the autoloader generation consistent. Composer simply reinstalls
 * those packages (from cache) on the next install, dumps a clean autoloader,
 * and wp-scoper deletes + this script reconciles again — a stable cycle.
 *
 * Idempotent: a no-op when nothing was deleted (e.g. the free/unscoped install
 * or a fresh tree). Runs as a composer post-install-cmd / post-update-cmd and
 * after the standalone `scope` / `scope:premium` scripts.
 */

$root        = dirname(__DIR__);
$installed   = $root . '/vendor/composer/installed.json';
$composerDir = $root . '/vendor/composer';

if (!is_file($installed)) {
    return; // nothing installed yet
}

$data = json_decode(file_get_contents($installed), true);
if (!is_array($data) || !isset($data['packages']) || !is_array($data['packages'])) {
    return;
}

$kept    = [];
$dropped = [];
foreach ($data['packages'] as $pkg) {
    $rel  = $pkg['install-path'] ?? ('../' . ($pkg['name'] ?? ''));
    $path = realpath($composerDir . '/' . $rel);
    if ($path !== false && is_dir($path)) {
        $kept[] = $pkg;
    } else {
        $dropped[] = $pkg['name'] ?? $rel;
    }
}

if (empty($dropped)) {
    return; // vendor and install record already agree
}

$data['packages'] = $kept;
if (isset($data['dev-package-names']) && is_array($data['dev-package-names'])) {
    $keptNames = array_column($kept, 'name');
    $data['dev-package-names'] = array_values(array_intersect($data['dev-package-names'], $keptNames));
}

file_put_contents(
    $installed,
    json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"
);

fwrite(STDERR, sprintf(
    "  → reconciled installed.json (dropped %d package(s) deleted by wp-scoper)\n",
    count($dropped)
));
