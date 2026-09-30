<?php

namespace WConvert\Discovery;

use InvalidArgumentException;

defined('ABSPATH') || exit;

/** Bounded documents, with no campaign or visitor data. */
final class PickerDocuments
{
    public const OCCASIONS = 'wconvert_picker_occasions';
    public const USER_KEY = 'wconvert_picker_preferences_';

    /** @return array<string, mixed> */
    public static function preferences(): array
    {
        return ['schema' => 1, 'revision' => 0, 'saved' => [], 'hidden' => [], 'events' => [], 'businesses' => [], 'markets' => [], 'show_featured' => true];
    }

    /** @param array<string, mixed> $input
     * @return array<string, mixed> */
    public static function validatePreferences(array $input): array
    {
        if (array_key_exists('show_featured', $input) && !is_bool($input['show_featured'])) throw new InvalidArgumentException(__('Invalid featured collection preference.', 'wconvert'));
        $output = ['show_featured' => $input['show_featured'] ?? true];
        foreach (['saved' => 200, 'hidden' => 100, 'events' => 100, 'businesses' => 3, 'markets' => 20] as $key => $bound) {
            $values = $input[$key] ?? null;
            if (!is_array($values) || !array_is_list($values) || count($values) > $bound) throw new InvalidArgumentException(sprintf(__('Invalid preference list: %s', 'wconvert'), $key));
            foreach ($values as $value) {
                if (!is_string($value) || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/D', $value)) throw new InvalidArgumentException(__('Invalid preference identifier.', 'wconvert'));
                if ($key === 'businesses' && !in_array($value, ['stores', 'services', 'publishers'], true)) throw new InvalidArgumentException(__('Invalid business.', 'wconvert'));
                if ($key === 'markets' && !preg_match('/^[A-Z]{2}$/D', $value)) throw new InvalidArgumentException(__('Use a two-letter market code.', 'wconvert'));
            }
            $output[$key] = array_values(array_unique($values));
        }
        return $output;
    }

    /** @param mixed $input
     * @return list<array<string, string>> */
    public static function validateOccasions($input): array
    {
        if (!is_array($input) || !array_is_list($input) || count($input) > 50) throw new InvalidArgumentException(__('Keep at most 50 occasions.', 'wconvert'));
        $output = []; $seen = [];
        foreach ($input as $entry) {
            if (!is_array($entry)) throw new InvalidArgumentException(__('Invalid occasion.', 'wconvert'));
            $id = $entry['id'] ?? '';
            $name = is_string($entry['name'] ?? null) ? trim($entry['name']) : '';
            if (!is_string($id) || !preg_match('/^[a-z0-9-]{1,64}$/D', $id) || isset($seen[$id]) || $name === '' || mb_strlen($name) > 120 || strip_tags($name) !== $name) throw new InvalidArgumentException(__('Use a unique occasion and a plain name under 120 characters.', 'wconvert'));
            foreach (['start', 'end'] as $key) {
                $date = $entry[$key] ?? null;
                $parsed = is_string($date) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;
                if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new InvalidArgumentException(__('Use a valid calendar date.', 'wconvert'));
            }
            if ($entry['end'] < $entry['start']) throw new InvalidArgumentException(__('The end date must follow the start date.', 'wconvert'));
            $seen[$id] = true;
            $output[] = ['id' => $id, 'name' => $name, 'start' => $entry['start'], 'end' => $entry['end']];
        }
        return $output;
    }
}
