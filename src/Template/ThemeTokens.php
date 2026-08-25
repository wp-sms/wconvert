<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The site theme's colours and type, as **values**.
 *
 * ============================================================================
 * INHERITANCE IS A VALUE COPY, AND IT IS OPT-IN.
 * ============================================================================
 * What this produces is a token map the merchant may copy into an [[Optin]]'s
 * own tokens. Nothing is stored saying where they came from, and nothing reads
 * the theme again afterwards.
 *
 * A stored "inherit from the theme" flag was the alternative and it is the
 * same mistake ADR 0010 refuses one layer up: an Optin takes a COPY of its
 * Template so that improving a Template never restyles a running Optin.
 * A live link to the theme would restyle every running Optin the day the
 * merchant switches theme or a theme update moves a palette slug — silently,
 * on a popup they approved months ago, with no human present.
 *
 * **Default off, and it stays off**, because the fastest way to make a popup
 * look broken is to give it three of a theme's colours and none of its
 * spacing. A merchant asks for this when their design is close and the palette
 * is what is missing.
 *
 * **Colours and type only — never shape.** A theme has no opinion about how
 * round a popup's corners are or how wide it is; those are the [[Template]]'s,
 * and copying a theme's `radius` over them would be inventing a value the
 * theme never expressed.
 *
 * @since 0.1.0
 */
final class ThemeTokens
{
    /**
     * Palette slugs to read each token from, best first.
     *
     * WordPress does not standardise these — a block theme names its palette
     * whatever it likes — so this is a preference order rather than a lookup,
     * and a token with no match is simply not offered. Offering a wrong colour
     * is worse than offering none: the merchant sees a design that looks
     * broken and has no way to tell which of the four went wrong.
     */
    private const SLUGS = [
        'bg' => ['base', 'background', 'white'],
        'fg' => ['contrast', 'foreground', 'text', 'black'],
        'accent' => ['primary', 'accent', 'accent-1', 'link'],
    ];

    /** Below this relative luminance a colour wants light text on it. */
    private const MID_LUMINANCE = 0.45;

    /**
     * The tokens this site's theme can fill in.
     *
     * Pure: the palette and the font family are passed in rather than read
     * here, the same arrangement {@see PolicyLink} has, so this is testable
     * without a WordPress install.
     *
     * @param array<string, string> $palette Palette slug => its colour.
     * @param string|null $font The theme's body font stack.
     * @return array<string, string>
     */
    public static function from(array $palette, ?string $font): array
    {
        $tokens = [];

        foreach (self::SLUGS as $token => $slugs) {
            foreach ($slugs as $slug) {
                if (isset($palette[$slug]) && $palette[$slug] !== '') {
                    $tokens[$token] = $palette[$slug];
                    break;
                }
            }
        }

        if ($font !== null && $font !== '') {
            $tokens['font'] = $font;
        }

        // The one derived value. A theme declares no "text on the accent
        // colour", and it has to be one or the other of the two we already
        // have — an accent button whose label cannot be read is worse than a
        // button in the wrong colour, because the merchant can see the second
        // one.
        $accentFg = self::readableOn($tokens['accent'] ?? null, $tokens);

        if ($accentFg !== null) {
            $tokens['accent-fg'] = $accentFg;
        }

        return $tokens;
    }

    /**
     * The theme's palette and body font, off the site.
     *
     * `wp_get_global_settings()` rather than `wp_get_global_styles()`: the
     * latter resolves to `var(--wp--preset--color--base)` references, which
     * name custom properties declared on the document and are invisible inside
     * the closed shadow root an Optin renders in (ADR 0009). A reference that
     * resolves to nothing renders as no colour at all.
     *
     * @return array<string, string>
     */
    public static function fromSite(): array
    {
        $settings = function_exists('wp_get_global_settings') ? wp_get_global_settings() : [];

        return self::from(self::palette($settings), self::font($settings));
    }

    /**
     * @param array<string, mixed> $settings
     * @return array<string, string>
     */
    private static function palette(array $settings): array
    {
        $colours = [];
        $palettes = is_array($settings['color']['palette'] ?? null) ? $settings['color']['palette'] : [];

        // Read in increasing order of deliberateness, so the later write
        // wins: WordPress's default palette, then the theme's own entry of the
        // same slug, then `custom` — the merchant's additions in the site
        // editor, which are the most deliberate of the three.
        foreach (['default', 'theme', 'custom'] as $origin) {
            foreach (is_array($palettes[$origin] ?? null) ? $palettes[$origin] : [] as $entry) {
                if (is_array($entry) && is_string($entry['slug'] ?? null) && is_string($entry['color'] ?? null)) {
                    $colours[$entry['slug']] = $entry['color'];
                }
            }
        }

        return $colours;
    }

    /**
     * @param array<string, mixed> $settings
     */
    private static function font(array $settings): ?string
    {
        $families = is_array($settings['typography']['fontFamilies'] ?? null)
            ? $settings['typography']['fontFamilies']
            : [];

        foreach (['default', 'theme', 'custom'] as $origin) {
            foreach (is_array($families[$origin] ?? null) ? $families[$origin] : [] as $entry) {
                // The FIRST family a theme declares is its body face by
                // convention, and there is no field saying which one is.
                // Wrong here costs a font the merchant can change in one
                // control; guessing from the slug would be wrong more often.
                if (is_array($entry) && is_string($entry['fontFamily'] ?? null) && $entry['fontFamily'] !== '') {
                    return $entry['fontFamily'];
                }
            }
        }

        return null;
    }

    /**
     * Which of the two text colours reads on this background, or null where
     * the background is not a colour this can measure.
     *
     * @param array<string, string> $tokens
     */
    private static function readableOn(?string $background, array $tokens): ?string
    {
        $luminance = $background === null ? null : self::luminance($background);

        if ($luminance === null) {
            return null;
        }

        $light = $tokens['bg'] ?? null;
        $dark = $tokens['fg'] ?? null;

        if ($light === null || $dark === null) {
            return null;
        }

        return $luminance < self::MID_LUMINANCE ? $light : $dark;
    }

    /**
     * Relative luminance of a hex colour, or null where it is not one.
     *
     * Null rather than a guess: a palette entry may be `rgb()`, `hsl()`, a
     * gradient or a custom property, and none of those can be measured without
     * a CSS engine. The caller offers no `accent-fg` in that case, which
     * leaves the [[Template]]'s own — a value someone chose.
     */
    private static function luminance(string $colour): ?float
    {
        $hex = ltrim(trim($colour), '#');

        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        if (strlen($hex) !== 6 || preg_match('/^[0-9a-fA-F]{6}$/', $hex) !== 1) {
            return null;
        }

        $channels = [];

        foreach ([0, 2, 4] as $at) {
            $channel = hexdec(substr($hex, $at, 2)) / 255;
            // sRGB → linear, which is what makes yellow read as light and blue
            // as dark. A plain average calls #0000ff and #ffff00 the same
            // brightness and puts white text on the yellow one.
            $channels[] = $channel <= 0.04045 ? $channel / 12.92 : (($channel + 0.055) / 1.055) ** 2.4;
        }

        return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
    }
}
