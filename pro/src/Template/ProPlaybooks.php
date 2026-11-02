<?php

namespace WConvert\Pro\Template;

use WConvert\Template\DesignWords;

defined('ABSPATH') || exit;

/** Setups accompany their module's designs; absent modules supply neither. */
final class ProPlaybooks
{
    public function __construct(private readonly string $pluginDir = WCONVERT_PRO_DIR, private readonly ?DesignWords $words = null)
    {
    }

    /** @return list<array<string, mixed>> */
    public function entries(): array
    {
        $words = $this->words ?? DesignWords::bundled($this->pluginDir);
        $entries = [];
        foreach (glob(rtrim($this->pluginDir, '/') . '/modules/*/playbooks/*.php') ?: [] as $file) {
            $entry = require $file;
            if (is_array($entry)) $entries[] = $words->playbook($entry);
        }
        return $entries;
    }
}
