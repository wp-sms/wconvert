<?php
/**
 * Reconcile vendor/composer/installed.json after wp-scoper runs.
 *
 * Copied from WSMS. wp-scoper (delete_vendor_packages: true) copies the licence
 * SDK into packages/ and deletes the original from vendor/, but never removes
 * it from Composer's install record. Composer regenerates its autoloader from
 * that record on the next install and whenever it runs a script (`composer
 * dist`), and warns or fatals on a package whose files are gone.
 *
 * Dropping the record for any package whose vendor directory no longer exists
 * keeps that consistent: Composer reinstalls it from cache on the next install,
 * wp-scoper deletes it again, and this reconciles again — a stable cycle.
 * Idempotent, and a no-op on a fresh tree. Runs as post-install-cmd and
 * post-update-cmd.
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
