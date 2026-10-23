<?php
/**
 * Plugin Name: POT coverage fixture
 */

$simple = _n('Fixture simple', 'Fixture simples', $n, 'wconvert-fixture');
$cast   = _n('Fixture cast', 'Fixture casts', (int) ($p['items'] ?? 0), 'wconvert-fixture');
$multi  = __(
    'Fixture multi',
    'wconvert-fixture'
);
$ctx    = _x('Fixture ctx', 'fixture context', 'wconvert-fixture');

// The same plural twice: make-pot extracts the first and drops the second. The
// msgid IS in the POT, so only a check on `#:` references sees the second one.
$shared = _n('Fixture shared', 'Fixture shareds', $n, 'wconvert-fixture');
$hidden = _n('Fixture shared', 'Fixture shareds', (int) ($p['items'] ?? 0), 'wconvert-fixture');

// A placeholder with no translators comment: make-pot's audit flags it, and
// the check must report exactly this one.
$uncommented = __('Fixture uncommented %s', 'wconvert-fixture');
