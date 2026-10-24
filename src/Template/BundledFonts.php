<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Licensed campaign faces served by this install, independent of remote-font permission. */
final class BundledFonts
{
    /** @var array<string, list<array{string, string, string}>> */
    private const FACES = [
        'DM Sans' => [['dm-sans.woff2', '100 1000', 'normal']],
        'Bebas Neue' => [['bebas-neue.woff2', '400', 'normal']],
        'Cormorant Garamond' => [['cormorant-garamond.woff2', '300 700', 'normal'], ['cormorant-garamond-italic.woff2', '300 700', 'italic']],
    ];

    /** @return list<string> */
    public static function families(): array
    {
        return array_keys(self::FACES);
    }

    /** Document-level declarations: shadow roots cannot declare font faces. No unused font file is fetched.
     * @param list<string> $families
     */
    public static function styleTag(array $families): string
    {
        $css = '';
        $wanted = array_map('strtolower', $families);
        $base = (defined('WCONVERT_URL') ? WCONVERT_URL : '') . 'resources/template-fonts/';
        foreach (self::FACES as $family => $faces) {
            if (!in_array(strtolower($family), $wanted, true)) continue;
            foreach ($faces as [$file, $weight, $style]) {
                // The family, path and descriptors are closed local data. A design supplies no URL or CSS.
                $url = str_replace(['\\', '"', '<', '>'], ['%5C', '%22', '%3C', '%3E'], $base . $file);
                $css .= '@font-face{font-family:"' . $family . '";font-style:' . $style . ';font-weight:' . $weight . ';font-display:swap;src:url("' . $url . '") format("woff2")}';
            }
        }
        return $css === '' ? '' : '<style data-wc-bundled-fonts>' . $css . '</style>';
    }

    public static function printAdminFaces(): void
    {
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Closed descriptors and encoded local URLs above.
        echo self::styleTag(self::families());
    }
}
