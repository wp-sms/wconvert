<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * Which occasion a campaign belongs to: `config.occasion`, or nothing
 * (ADR 0149 §4).
 *
 * ============================================================================
 * DELETING AN OCCASION DETACHES ON READ, AND THE NEXT SAVE MAKES IT TRUE.
 * ============================================================================
 * Deleting an occasion writes no campaign (ADR 0149 §5). A campaign whose id
 * names no existing occasion reads as belonging to none, and its next save
 * hands that id back. So an id the campaign ALREADY held and that no longer
 * exists is dropped without a word: the merchant did not choose it in this
 * save, and refusing the save would block every edit of a campaign whose
 * occasion someone else deleted.
 *
 * Any OTHER unknown id is a choice made in this save, and that is refused.
 */
final class OccasionLink
{
    /**
     * @param mixed $value What the save carries in `config.occasion`.
     * @param list<string> $occasionIds The occasions that exist now.
     * @param string|null $stored What the campaign held before this save.
     * @throws InvalidOccasion
     */
    public static function normalize(mixed $value, array $occasionIds, ?string $stored): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_string($value) && in_array($value, $occasionIds, true)) {
            return $value;
        }
        if ($value === $stored) {
            return null;
        }
        throw new InvalidOccasion(is_string($value) ? $value : get_debug_type($value));
    }

    /**
     * What a stored link reads as: the id while that occasion exists, null after.
     *
     * @param list<string> $occasionIds
     */
    public static function read(mixed $stored, array $occasionIds): ?string
    {
        return is_string($stored) && in_array($stored, $occasionIds, true) ? $stored : null;
    }
}
