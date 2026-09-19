<?php

namespace WConvert\Privacy;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * How much privacy help WConvert adds while a merchant creates a Campaign.
 *
 * This is one site-wide WordPress option, not a database column and not part
 * of an [[Optin]]. It changes the starting point copied into a NEW draft and
 * the editor guidance around that draft. Existing Optins keep their snapshots
 * exactly as they are.
 *
 * The setting never disables privacy infrastructure. Export, erasure,
 * retention, Consent Records, the WordPress policy suggestion and the Data Map
 * do not consult it.
 *
 * @since 0.1.0
 */
final class PrivacyGuidance
{
    public const OPTION = 'wconvert_privacy_guidance';

    public function __construct(private readonly OptionStore $options)
    {
    }

    /** Guidance is on until the merchant explicitly turns it off. */
    public function enabled(): bool
    {
        $stored = $this->options->get(self::OPTION, true);

        return !in_array($stored, [false, 0, '0', ''], true);
    }

    public function set(bool $enabled): void
    {
        // WordPress serializes boolean false as an empty option value. Store
        // explicit integers so an off preference survives a real DB round trip.
        $this->options->set(self::OPTION, $enabled ? 1 : 0);
    }

    /**
     * The copy a new Campaign setup receives under the current preference.
     *
     * A Playbook's link with no address is the site's Privacy Policy link
     * (ADR 0032). When guidance is off, those automatic notices and the
     * automatic consent wording are left out. A list keeps null placeholders
     * so repeated Slot Roles stay aligned: removing item zero must not move a
     * success-screen sentence into the form's fine-print slot.
     *
     * @param array<string, mixed> $copy
     * @return array<string, mixed>
     */
    public function copyFor(array $copy): array
    {
        if ($this->enabled()) {
            return $copy;
        }

        unset($copy['consent_text']);

        if (!array_key_exists('fine_print', $copy)) {
            return $copy;
        }

        $finePrint = $copy['fine_print'];

        if (self::hasPolicyLink($finePrint)) {
            unset($copy['fine_print']);

            return $copy;
        }

        if (is_array($finePrint) && $finePrint === array_values($finePrint)) {
            $copy['fine_print'] = array_map(
                static fn ($words) => self::hasPolicyLink($words) ? null : $words,
                $finePrint
            );
        }

        return $copy;
    }

    /** @param mixed $words */
    private static function hasPolicyLink($words): bool
    {
        return is_array($words) && is_array($words['link'] ?? null);
    }
}
