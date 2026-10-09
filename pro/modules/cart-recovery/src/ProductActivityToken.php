<?php
namespace WConvert\Pro\Module\CartRecovery;

defined('ABSPATH') || exit;

/** Stateless proof of a served card, with no visitor or cart identity. */
final class ProductActivityToken
{
    public const WINDOW = 1800;
    public static function issue(string $id, string $revision, int $product, int $now, string $secret): string
    {
        $expires = $now + self::WINDOW;
        return $expires . '.' . hash_hmac('sha256', "$id|$revision|$product|$expires", $secret);
    }
    public static function valid(string $token, string $id, string $revision, int $product, int $now, string $secret): bool
    {
        if ($product < 1 || !preg_match('/^([0-9]{10})\.([a-f0-9]{64})$/D', $token, $parts)) return false;
        $expires = (int) $parts[1];
        return $expires >= $now && $expires <= $now + self::WINDOW
            && hash_equals(hash_hmac('sha256', "$id|$revision|$product|$expires", $secret), $parts[2]);
    }
}
