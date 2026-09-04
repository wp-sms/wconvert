<?php

/**
 * The adapter seam, against a real WordPress.
 *
 * ============================================================================
 * WHAT A UNIT TEST STRUCTURALLY CANNOT PROVE.
 * ============================================================================
 * `RoleRegistryTest` builds a {@see \WConvert\Targeting\RoleRegistry} by hand
 * and asserts the union, which is the arithmetic. What it cannot reach is the
 * only claim the seam actually makes: that a plugin loaded beside WConvert can
 * FIND the registry and add to it, on a hook that fires at a moment when
 * adding still changes what the site does.
 *
 * That is a property of the container's lifetime and of `wconvert_loaded`, and
 * a fake registry passes it however wrong both are. So this registers a source
 * the way the docblock on {@see \WConvert\Targeting\RoleSource} tells a third
 * party to, and then asks the two surfaces that read one.
 *
 * Run it the way `README.md` describes for every `bin/verify-*.php`: through
 * `@wp-playground/cli php`, with an mu-plugin that `require`s the plugin file
 * and an explicit `Installer::install()` first.
 *
 * @since 0.1.0
 */

use WConvert\Bootstrap;
use WConvert\Rules\RuleCatalogue;
use WConvert\Targeting\RoleRegistry;
use WConvert\Targeting\RoleSource;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "This script runs inside WordPress.\n");
    exit(1);
}

$failures = [];

$check = static function (string $what, bool $held) use (&$failures): void {
    echo ($held ? '  ✓ ' : '  ✗ ') . $what . "\n";

    if (!$held) {
        $failures[] = $what;
    }
};

echo "==> verify-role-sources\n";

/**
 * A membership plugin, as small as one can be.
 *
 * Anonymous on purpose: an adapter is two methods, and anything this file had
 * to name would be machinery the seam does not require.
 */
$adapter = new class implements RoleSource {
    /** @return array<string, string> */
    public function offered(): array
    {
        return ['plan_gold' => 'Gold plan'];
    }

    /** @return list<string> */
    public function held(): array
    {
        return ['plan_gold'];
    }
};

// THE INTEGRATION, exactly as `RoleSource`'s docblock spells it. If this line
// needs anything else, the seam is not a seam.
Bootstrap::container()->resolve(RoleRegistry::class)->add($adapter);

$registry = Bootstrap::container()->resolve(RoleRegistry::class);

$check('the registry the container holds is the one an adapter added to', in_array('plan_gold', $registry->held(), true));
$check('WordPress\'s own roles are still there beside it', array_key_exists('subscriber', $registry->offered()));
$check('the level is offered by its own name', ($registry->offered()['plan_gold'] ?? null) === 'Gold plan');

/*
 * And the surface a merchant actually meets: the rules catalogue the builder
 * fetches. A source nobody can choose from is a source that does nothing.
 */
$options = [];

foreach (Bootstrap::container()->resolve(RuleCatalogue::class)->all()['targeting'] as $type) {
    if (($type['type'] ?? null) !== 'role') {
        continue;
    }

    $options = array_column($type['params']['value']['options'] ?? [], 'label', 'value');
}

$check('the builder offers the level beside every WordPress role', ($options['plan_gold'] ?? null) === 'Gold plan');
$check('and offers the roles this site registered', array_key_exists('subscriber', $options));

if ($failures !== []) {
    fwrite(STDERR, "\n==> verify-role-sources FAILED:\n");

    foreach ($failures as $failure) {
        fwrite(STDERR, '  ✗ ' . $failure . "\n");
    }

    exit(1);
}

echo "  ✓ the role seam is reachable from outside the plugin\n";
