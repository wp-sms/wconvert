<?php

namespace WConvert\Report;

defined('ABSPATH') || exit;

/**
 * `wp_mail()` as HTML with a plain-text part, so whatever the site uses to
 * send mail (an SMTP plugin, the host's mailer) sends this too.
 *
 * Both hooks are added for this one send and removed straight after it, so
 * no other email from the site is changed.
 */
final class WpSummaryMailer implements SummaryMailer
{
    public function send(array $to, string $subject, string $html, string $text): bool
    {
        $alt = static function ($mailer) use ($text): void {
            if (is_object($mailer) && property_exists($mailer, 'AltBody')) {
                $mailer->AltBody = $text;
            }
        };
        // Only replace WordPress's own default name; a mail plugin's choice stays.
        $name = static fn ($current): string => $current === 'WordPress' ? 'WConvert' : (string) $current;

        add_action('phpmailer_init', $alt);
        add_filter('wp_mail_from_name', $name);

        try {
            return wp_mail($to, $subject, $html, ['Content-Type: text/html; charset=UTF-8']);
        } finally {
            remove_action('phpmailer_init', $alt);
            remove_filter('wp_mail_from_name', $name);
        }
    }
}
