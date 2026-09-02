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
 * the merchant typed and therefore still reads as their words.
 *
 * ========================================================================
 * THREE STATES, BECAUSE AN EMPTY ANSWER MEANS THREE DIFFERENT THINGS.
 * ========================================================================
 * This began as one string feeding one success sentence, where *"nothing to
 * say"* and *"nothing chosen"* could safely collapse: the sentence simply got
 * shorter. It now also feeds the Destinations payload, which renders a LINE
 * per Destination, and there the collapse is a lie:
 *
 * - `null` — **this type selects nothing.** The lead-magnet email's URL,
 *   subject and body are configuration rather than a target, and a webhook has
 *   no selector at all. Such a Destination is perfectly configured, so a
 *   screen that said *"not pointed at anything yet"* would be reporting a
 *   fault against a working integration.
 * - `''` — it selects something and **nothing is chosen.** A MailPoet
 *   Destination with no list ticked really will push nowhere useful, and
 *   saying so changes what the merchant does next (ADR 0042).
 * - a string — where it lands, in the merchant's words.
 *
 * The caller that could not READ a schema — an ESP having a bad time — owns
 * the fourth case and answers `null` for it, because silence is honest where a
 * guess is not. See {@see \WConvert\Rest\DestinationController::targetOf()}.
 *
 * @since 0.1.0
 */
final class ConfiguredTarget
{
    /**
     * The field kind that selects things inside the remote system.
     *
     * One kind, and it is the same one `LIST_KINDS` names in
     * `resources/admin/src/destinations/settings.tsx`: a Destination points at
     * a SET of things, and every other kind on the schema is configuration
     * rather than a target.
     */
    private const SELECTS = 'ids';

    /**
     * @param array<string, mixed> $schema
     * @param array<string, mixed> $settings
     * @return string|null Null where the type selects nothing at all.
     */
    public static function of(array $schema, array $settings): ?string
    {
        $selects = false;
        $named = [];

        foreach ($schema as $key => $field) {
            if (!is_array($field) || ($field['type'] ?? null) !== self::SELECTS) {
                continue;
            }

            // **Set by the SCHEMA and never by the settings**, which is the
            // whole of the `null`/`''` distinction: a type that offers a
            // selector has one whether or not the merchant has used it.
            $selects = true;

            $chosen = $settings[$key] ?? [];
            $labels = self::labels($field);

            foreach (is_array($chosen) ? $chosen : [] as $id) {
                if (is_string($id) && $id !== '') {
                    $named[] = $labels[$id] ?? $id;
                }
            }
        }

        return $selects ? implode(', ', $named) : null;
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
