<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * **What a configured [[Destination]] is pointed at, in the merchant's own
 * words** — the list, the audience, the tags.
 *
 * ========================================================================
 * READ OFF THE SCHEMA, SO NO TYPE HAS TO DECLARE IT.
 * ========================================================================
 * A type's {@see DestinationType::settingsSchema()} already says which fields
 * select a target and — for the ones whose options the provider could
 * enumerate — what each is CALLED. So *"landed on Newsletter"* falls out of
 * what is already there, and a type that ships tomorrow gets it without
 * implementing anything.
 *
 * The alternative was a `describeTarget()` on {@see DestinationType}, which is
 * a method for one screen on an interface that deliberately has no `Supports*`
 * capability split (#4).
 *
 * **Its own class rather than a private helper on {@see TestReport}**, because
 * the two change for different reasons: one is the wording a merchant reads,
 * the other is the shape of a settings schema. A field kind added to
 * `SettingsField` is an edit here and nowhere near a sentence.
 *
 * A field whose options the provider could not enumerate — WSMS's tags, which
 * are the merchant's own strings — falls back to the stored ids, which is what
 * the merchant typed and therefore still reads as their words. A field that
 * selects nothing (the lead-magnet email's URL and subject) is not a list, so
 * it contributes nothing.
 *
 * @since 0.1.0
 */
final class ConfiguredTarget
{
    /**
     * The field kind that selects things inside the remote system.
     *
     * One kind, and it is the same one `LIST_KINDS` names in
     * `resources/admin/src/destinations/Destinations.tsx`: a Destination
     * points at a SET of things, and every other kind on the schema is
     * configuration rather than a target.
     */
    private const SELECTS = 'ids';

    /**
     * @param array<string, mixed> $schema
     * @param array<string, mixed> $settings
     */
    public static function of(array $schema, array $settings): string
    {
        $named = [];

        foreach ($schema as $key => $field) {
            if (!is_array($field) || ($field['type'] ?? null) !== self::SELECTS) {
                continue;
            }

            $chosen = $settings[$key] ?? [];
            $labels = self::labels($field);

            foreach (is_array($chosen) ? $chosen : [] as $id) {
                if (is_string($id) && $id !== '') {
                    $named[] = $labels[$id] ?? $id;
                }
            }
        }

        return implode(', ', $named);
    }

    /**
     * One field's option ids mapped to their labels, or `[]` where the
     * provider could not enumerate them.
     *
     * @param array<string, mixed> $field
     * @return array<string, string>
     */
    private static function labels(array $field): array
    {
        $labels = [];

        foreach (is_array($field['options'] ?? null) ? $field['options'] : [] as $option) {
            if (is_array($option) && isset($option['value'], $option['label'])) {
                $labels[(string) $option['value']] = (string) $option['label'];
            }
        }

        return $labels;
    }
}
