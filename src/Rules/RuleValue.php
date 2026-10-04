<?php
namespace WConvert\Rules;
defined('ABSPATH') || exit;
/** Shared validation for bounded store selectors and numeric range controls. */
final class RuleValue
{
    public static function ids(mixed $value): bool
    {
        return is_array($value) && array_is_list($value) && count($value) > 0 && count($value) <= 20
            && count(array_unique($value, SORT_REGULAR)) === count($value)
            && count(array_filter($value, static fn ($id): bool => is_int($id) && $id > 0)) === count($value);
    }
    public static function range(mixed $value, bool $money): bool
    {
        if (!is_array($value) || array_diff(array_keys($value), ['operator', 'min', 'max', 'currency', 'decimals']) !== []
            || !in_array($value['operator'] ?? null, ['min', 'max', 'between'], true)) return false;
        $valid = static fn ($n): bool => (is_int($n) || is_float($n)) && is_finite((float) $n) && $n >= 0 && $n <= 1000000000;
        if (!$valid($value['min'] ?? null)) return false;
        $numbers = [$value['min']];
        if ($value['operator'] === 'between') {
            if (!$valid($value['max'] ?? null) || $value['max'] < $value['min']) return false;
            $numbers[] = $value['max'];
        }
        if ($money && (!is_string($value['currency'] ?? null) || preg_match('/^[A-Z]{3}$/D', $value['currency']) !== 1
            || !is_int($value['decimals'] ?? null) || $value['decimals'] < 0 || $value['decimals'] > 6)) return false;
        foreach ($numbers as $number) {
            if (abs($number - round($number, $money ? $value['decimals'] : 0)) > 0.000000001) return false;
        }
        return true;
    }
}
