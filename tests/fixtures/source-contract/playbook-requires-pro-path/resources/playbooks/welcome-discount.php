<?php

/*
 * A Playbook, and a Playbook SHIPS. PlaybookLibrary reads resources/playbooks
 * by path constant, so this file is inside the free ZIP and inside free's tree
 * as ADR 0029 defines it — "src/, resources/, and the plugin files at the tree
 * root".
 *
 * The leak this fixture exists for was unwatched until #37: the PHP scan
 * covered src/ and the root and stopped there, so a Playbook reaching into
 * Pro passed the source contract AND the artifact contract.
 */

require_once WCONVERT_DIR . 'pro/src/Playbook/PremiumSteps.php';

return [
    'goal' => 'grow_email_list',
];
