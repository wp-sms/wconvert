<?php

namespace WConvert\Pro\Template;

defined('ABSPATH') || exit;

/** Setups accompany their module's designs; absent modules supply neither. */
final class ProPlaybooks
{
    public function __construct(private readonly string $pluginDir = WCONVERT_PRO_DIR)
    {
    }

    /** @return list<array<string, mixed>> */
    public function entries(): array
    {
        $entries = [];
        foreach (glob(rtrim($this->pluginDir, '/') . '/modules/*/playbooks/*.php') ?: [] as $file) {
            $entry = require $file;
            if (is_array($entry)) $entries[] = $entry;
        }
        return $entries;
    }
}
