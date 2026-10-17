<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * A short fingerprint of a campaign's draft — name, Goal and config — so a
 * writer that read it can say which version it read (ADR 0154).
 *
 * Computed on read and stored nowhere: the draft IS the state, so a column
 * would be a second copy of it. `PATCH /optins/{id}` compares one it is handed
 * and refuses a stale write with 409 `wconvert_optin_changed`.
 */
final class ConfigRevision
{
    public static function of(Optin $optin): string
    {
        return substr(hash('sha256', (string) wp_json_encode([$optin->name, $optin->goal, $optin->config])), 0, 16);
    }
}
