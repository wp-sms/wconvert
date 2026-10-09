<?php
namespace WConvert\Optin;

defined('ABSPATH') || exit;

/** Passive campaign configuration; external tracking is supplied by Pro. */
final class AnalyticsPreference
{
    // phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
    /** @param mixed $value
     * @return array{off: bool, label: string} */
    public static function normalize($value): array
    {
        if ($value === null) return ['off' => false, 'label' => ''];
        if (!is_array($value) || array_diff(array_keys($value), ['off', 'label']) !== []
            || (isset($value['off']) && !is_bool($value['off'])) || (isset($value['label']) && !is_string($value['label']))) {
            throw new \InvalidArgumentException(__('Invalid analytics preferences.', 'wconvert'));
        }
        $label = trim($value['label'] ?? '');
        if (preg_match('/[<>\x00-\x1f\x7f]/u', $label) || preg_match('/^.{0,80}$/usD', $label) !== 1) {
            throw new \InvalidArgumentException(__('Use an analytics label of up to 80 characters without markup or personal information.', 'wconvert'));
        }
        return ['off' => $value['off'] ?? false, 'label' => $label];
    }
    // phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
}
