<?php

namespace WConvert\Report;

defined('ABSPATH') || exit;

/**
 * The weekly summary as an HTML email and a plain-text twin (ADR 0176).
 *
 * The markup is the approved prototype's:
 * - **Tables and inline styles.** Gmail and Outlook drop most CSS.
 * - **No images at all.** The brand mark is a lettered cell, so the email
 *   reads the same with images blocked.
 * - **One `<style>` block** adds phone stacking and a dark palette where a
 *   client supports them. Everything still reads without it.
 *
 * Every value is escaped here. {@see WeeklySummary} produces plain text.
 */
final class SummaryTemplate
{
    private const FONT = "'DM Sans',Arial,Helvetica,sans-serif";

    /** @param array<string, mixed> $m The {@see WeeklySummary::compose()} model. */
    public static function html(array $m): string
    {
        $font = self::FONT;
        $site = esc_html($m['site']);
        $tiles = '';
        $width = (int) floor(100 / max(1, count($m['tiles'])));

        foreach ($m['tiles'] as $tile) {
            $color = ['up' => '#17703f', 'down' => '#b42318'][$tile['tone']] ?? '#6b6056';
            $class = ['up' => 'wce-up', 'down' => 'wce-down'][$tile['tone']] ?? 'wce-muted';
            $change = $tile['change'] === '' ? '' : '<p style="margin:0;font-size:13px;line-height:18px;font-weight:500;color:' . $color . ';" class="' . $class . '">' . esc_html($tile['change']) . '</p>';
            $tiles .= '<td class="wce-col" width="' . $width . '%" valign="top" style="width:' . $width . '%;padding:0 6px;vertical-align:top;">'
                . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f5f1" class="wce-tile" style="background-color:#f6f5f1;border:1px solid #ece7df;border-radius:10px;">'
                . '<tr><td style="padding:14px 16px 13px 16px;font-family:' . $font . ';">'
                . '<p style="margin:0;font-size:12px;line-height:16px;font-weight:600;color:#6b6056;" class="wce-muted">' . esc_html($tile['label']) . '</p>'
                . '<p style="margin:4px 0 2px 0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.5px;color:#302720;" class="wce-ink">' . esc_html($tile['value']) . '</p>'
                . $change
                . '</td></tr></table></td>';
        }

        $sections = ($m['best'] ? self::section($m['best'], null) : '') . ($m['insight'] ? self::section($m['insight'], '#c98a1b') : '');
        $actions = '';

        foreach ($m['actions'] as $i => $action) {
            $label = esc_html($action['label']);
            $url = esc_url($action['url']);
            $actions .= $i === 0
                ? '<td bgcolor="#302720" class="wce-btn" style="background-color:#302720;border-radius:8px;"><a href="' . $url . '" class="wce-btn-a" style="display:inline-block;padding:12px 22px;font-family:' . $font . ';font-size:15px;line-height:20px;font-weight:600;color:#faf6ed;text-decoration:none;border-radius:8px;">' . $label . '</a></td>'
                : '<td width="12" class="wce-gap" style="width:12px;font-size:0;line-height:0;">&nbsp;</td><td class="wce-btn2" style="border:1px solid #cfc8bc;border-radius:8px;"><a href="' . $url . '" class="wce-btn2-a" style="display:inline-block;padding:11px 20px;font-family:' . $font . ';font-size:15px;line-height:20px;font-weight:600;color:#302720;text-decoration:none;border-radius:8px;">' . $label . '</a></td>';
        }

        $f = $m['footer'];

        return '<!DOCTYPE html><html lang="' . esc_attr(self::lang()) . '" dir="' . (self::rtl() ? 'rtl' : 'ltr') . '"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">'
            . '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">'
            . '<title>' . esc_html($m['subject']) . '</title><style>' . self::css() . '</style></head>'
            . '<body style="margin:0;padding:0;background-color:#f6f5f1;" class="wce-canvas">'
            . '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f6f5f1;" class="wce-pre">' . esc_html($m['preheader']) . str_repeat('&#8199;&#847;', 30) . '</div>'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f5f1" class="wce-canvas" style="background-color:#f6f5f1;width:100%;"><tr><td align="center" class="wce-outer" style="padding:32px 16px;">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="wce-shell" style="width:600px;max-width:600px;">'
            // Brand row: text only.
            . '<tr><td style="padding:0 4px 16px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            . '<td style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
            . '<td width="28" height="28" bgcolor="#302720" align="center" class="wce-mark" style="width:28px;height:28px;background-color:#302720;border-radius:7px;font-family:' . $font . ';font-size:16px;line-height:28px;font-weight:700;color:#e2f475;mso-line-height-rule:exactly;" aria-hidden="true">W</td>'
            . '<td style="padding:0 10px;font-family:' . $font . ';font-size:17px;line-height:22px;font-weight:700;color:#302720;" class="wce-ink">WConvert</td>'
            . '</tr></table></td>'
            . '<td align="' . (self::rtl() ? 'left' : 'right') . '" style="vertical-align:middle;font-family:' . $font . ';font-size:13px;line-height:18px;color:#6b6056;" class="wce-muted">' . $site . '</td>'
            . '</tr></table></td></tr>'
            // Card.
            . '<tr><td bgcolor="#ffffff" class="wce-card" style="background-color:#ffffff;border:1px solid #e4dfd6;border-radius:12px;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
            . '<tr><td height="6" bgcolor="#e2f475" style="height:6px;line-height:6px;font-size:6px;background-color:#e2f475;border-radius:12px 12px 0 0;">&nbsp;</td></tr>'
            . '<tr><td class="wce-pad" style="padding:28px 32px 8px 32px;font-family:' . $font . ';">'
            . '<p style="margin:0 0 6px 0;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:#6b6056;" class="wce-muted">' . esc_html($m['eyebrow']) . '</p>'
            . '<h1 style="margin:0;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:#302720;" class="wce-ink wce-h1">' . esc_html($m['headline']) . '</h1>'
            . '<p style="margin:8px 0 0 0;font-size:15px;line-height:22px;color:#4a4038;" class="wce-body">' . esc_html($m['lede']) . '</p>'
            . '</td></tr>'
            . '<tr><td class="wce-pad-tiles" style="padding:20px 26px 4px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' . $tiles . '</tr></table></td></tr>'
            . $sections
            . '<tr><td class="wce-pad" style="padding:24px 32px 32px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" class="wce-actions"><tr>' . $actions . '</tr></table></td></tr>'
            . '</table></td></tr>'
            // Footer.
            . '<tr><td class="wce-muted" style="padding:20px 8px 0 8px;font-family:' . $font . ';font-size:12px;line-height:18px;color:#6b6056;">'
            . '<p style="margin:0 0 6px 0;">' . esc_html($f['note']) . '</p>'
            . '<p style="margin:0;">' . esc_html($f['reason']) . ' <a href="' . esc_url($f['url']) . '" class="wce-link" style="color:#1f5a6b;text-decoration:underline;">' . esc_html($f['link']) . '</a></p>'
            . '</td></tr>'
            . '</table></td></tr></table></body></html>';
    }

    /**
     * The same summary as plain text, for clients that show no HTML and for
     * spam filters that weigh a missing text part.
     *
     * @param array<string, mixed> $m
     */
    public static function text(array $m): string
    {
        $lines = [$m['eyebrow'], '', $m['headline'], $m['lede'], ''];

        foreach ($m['tiles'] as $tile) {
            $lines[] = $tile['label'] . ': ' . $tile['value'] . ($tile['change'] === '' ? '' : ' (' . $tile['change'] . ')');
        }

        foreach (array_filter([$m['best'], $m['insight']]) as $section) {
            $lines[] = '';
            $lines[] = $section['eyebrow'] . ': ' . $section['title'];
            $lines[] = $section['body'];
        }

        $lines[] = '';

        foreach ($m['actions'] as $action) {
            $lines[] = $action['label'] . ': ' . $action['url'];
        }

        $f = $m['footer'];
        array_push($lines, '', '—', $f['note'], $f['reason'], $f['link'] . ': ' . $f['url']);

        return implode("\n", $lines) . "\n";
    }

    /** @param array{eyebrow: string, title: string, body: string} $s */
    private static function section(array $s, ?string $accent): string
    {
        $font = self::FONT;
        $bar = $accent === null ? '' : '<td width="3" bgcolor="' . $accent . '" style="width:3px;background-color:' . $accent . ';border-radius:2px;">&nbsp;</td><td width="14" style="width:14px;">&nbsp;</td>';
        $rule = $accent === null ? 'border-top:1px solid #ece7df;padding-top:18px;' : '';

        return '<tr><td class="wce-pad" style="padding:20px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' . $bar
            . '<td class="' . ($accent === null ? 'wce-rule' : '') . '" style="font-family:' . $font . ';' . $rule . '">'
            . '<p style="margin:0 0 4px 0;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:#6b6056;" class="wce-muted">' . esc_html($s['eyebrow']) . '</p>'
            . '<p style="margin:0;font-size:16px;line-height:22px;font-weight:600;color:#302720;" class="wce-ink">' . esc_html($s['title']) . '</p>'
            . '<p style="margin:3px 0 0 0;font-size:14px;line-height:20px;color:#4a4038;" class="wce-body">' . esc_html($s['body']) . '</p>'
            . '</td></tr></table></td></tr>';
    }

    private static function css(): string
    {
        return 'body{margin:0;padding:0;-webkit-text-size-adjust:100%;}'
            . 'a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}'
            . '@media (max-width:480px){'
            . '.wce-shell{width:100%!important;}.wce-outer{padding:20px 10px!important;}'
            . '.wce-pad{padding-left:20px!important;padding-right:20px!important;}.wce-pad-tiles{padding:16px 14px 0 14px!important;}'
            . '.wce-col{display:block!important;width:100%!important;padding:0 6px 10px 6px!important;box-sizing:border-box;}'
            . '.wce-h1{font-size:22px!important;line-height:28px!important;}.wce-gap{display:none!important;}'
            . '.wce-actions{width:100%!important;}.wce-actions td{display:block!important;width:auto!important;text-align:center;}'
            . '.wce-btn2{margin-top:10px;}.wce-actions a{display:block!important;}}'
            . '@media (prefers-color-scheme:dark){'
            . '.wce-canvas{background-color:#15120f!important;}.wce-card{background-color:#221d18!important;border-color:#3a322b!important;}'
            . '.wce-tile{background-color:#2b251f!important;border-color:#3d352d!important;}.wce-ink{color:#f4efe6!important;}'
            . '.wce-body{color:#d8cfc3!important;}.wce-muted{color:#ab9f92!important;}.wce-up{color:#7fd4a0!important;}'
            . '.wce-down{color:#ff9a8b!important;}.wce-rule{border-color:#3a322b!important;}'
            . '.wce-mark{background-color:#e2f475!important;color:#302720!important;}.wce-btn{background-color:#e2f475!important;}'
            . '.wce-btn-a{color:#302720!important;}.wce-btn2{border-color:#5a5047!important;}.wce-btn2-a{color:#f4efe6!important;}'
            . '.wce-link{color:#9fd3e1!important;}.wce-pre{color:#15120f!important;}}';
    }

    private static function lang(): string
    {
        return function_exists('get_bloginfo') ? (string) get_bloginfo('language') : 'en';
    }

    private static function rtl(): bool
    {
        return function_exists('is_rtl') && is_rtl();
    }
}
