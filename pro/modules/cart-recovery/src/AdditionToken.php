<?php
namespace WConvert\Pro\Module\CartRecovery;

defined('ABSPATH') || exit;

/** Fresh same-session capability, never embedded in cacheable product markup. */
final class AdditionToken
{
    public const WINDOW = 1800;

    public static function issue(string $session, string $campaign, string $revision, string $mount, int $now, string $secret): string
    {
        $payload = $mount . ':' . ($now + self::WINDOW);
        return $payload . ':' . hash_hmac('sha256', implode('|', [$session, $campaign, $revision, $payload]), $secret);
    }

    /** @return array{mount: string, expires: int}|null */
    public static function read(string $token, string $session, string $campaign, string $revision, int $now, string $secret): ?array
    {
        $parts = explode(':', $token);
        if (count($parts) !== 3 || !ctype_digit($parts[1]) || (int) $parts[1] <= $now || (int) $parts[1] > $now + self::WINDOW) return null;
        $expected = hash_hmac('sha256', implode('|', [$session, $campaign, $revision, $parts[0] . ':' . $parts[1]]), $secret);
        return hash_equals($expected, $parts[2]) ? ['mount' => $parts[0], 'expires' => (int) $parts[1]] : null;
    }
}
