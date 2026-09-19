<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/** Keeps provider diagnostics useful without copying contact details or secrets into logs. */
final class DiagnosticSanitizer
{
    private const MAX_LENGTH = 500;

    /**
     * @param array<mixed> $personal Values from the submitted Lead or test profile.
     * @param array<mixed> $secrets Saved provider credentials.
     */
    public static function message(string $message, array $personal = [], array $secrets = []): string
    {
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', ' ', $message) ?? $message;
        $clean = preg_replace('/[\r\n\t]+/u', ' ', $clean) ?? $clean;

        // Recognisable values are replaced first even when a provider formats
        // the rest of its sentence differently from another provider.
        $clean = preg_replace('/(?<![\pL\pN._%+\-])[\pL\pN.!#$%&\'*+\/=?^_`{|}~-]+@[\pL\pN-]+(?:\.[\pL\pN-]+)+(?![\pL\pN._%+\-])/u', '[email]', $clean) ?? $clean;
        $clean = preg_replace('/(?<!\w)(?:\+|00)\d[\d\s().-]{5,}\d(?!\w)/u', '[phone]', $clean) ?? $clean;
        $clean = self::replaceKnown($clean, self::strings($personal), '[personal data]', 2, true);
        $clean = self::replaceKnown($clean, self::strings($secrets), '[secret]', 5, false);

        // Defensive fallback for providers that label a secret we did not
        // receive as configuration (for example, a refreshed access token).
        $clean = preg_replace(
            '/\b(api[ _-]?key|access[ _-]?token|authorization|bearer)\b(\s*[:=]?\s*)[^\s,;]+/iu',
            '$1$2[secret]',
            $clean
        ) ?? $clean;

        return mb_substr(trim(preg_replace('/ {2,}/', ' ', $clean) ?? $clean), 0, self::MAX_LENGTH);
    }

    /**
     * @param list<string> $values
     */
    private static function replaceKnown(
        string $message,
        array $values,
        string $replacement,
        int $minimum,
        bool $bounded
    ): string
    {
        usort($values, static fn (string $left, string $right): int => strlen($right) <=> strlen($left));

        foreach (array_unique($values) as $value) {
            if (mb_strlen($value) < $minimum) {
                continue;
            }

            if ($bounded) {
                $message = preg_replace(
                    '/(?<![\pL\pN])' . preg_quote($value, '/') . '(?![\pL\pN])/iu',
                    $replacement,
                    $message
                ) ?? $message;
            } else {
                $message = str_ireplace($value, $replacement, $message);
            }
        }

        return $message;
    }

    /**
     * @param array<mixed> $values
     * @return list<string>
     */
    private static function strings(array $values): array
    {
        $strings = [];
        array_walk_recursive($values, static function ($value) use (&$strings): void {
            if (is_scalar($value) && trim((string) $value) !== '') {
                $strings[] = trim((string) $value);
            }
        });

        return $strings;
    }
}
