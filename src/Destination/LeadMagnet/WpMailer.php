<?php

namespace WConvert\Destination\LeadMagnet;

defined('ABSPATH') || exit;

/**
 * {@see Mailer} over WordPress's own mail stack.
 *
 * Named for what it is over rather than for what it does — the arrangement
 * {@see \WConvert\Storage\WpOptionStore} has with `OptionStore` and
 * {@see \WConvert\Destination\Wsms\WpWsmsContacts} has with `WsmsContacts`.
 *
 * **This is the whole of the coupling to `wp_mail()`.** Whatever the site has
 * done to it — SMTP plugins, a transactional-mail service, a filter that
 * rewrites the From address — is the site's business and happens behind this
 * call. WConvert configures none of it and reads none of it back.
 *
 * @since 0.1.0
 */
final class WpMailer implements Mailer
{
    /**
     * WordPress's `is_email()` rather than `filter_var`, deliberately: this is
     * the predicate `wp_mail()` itself applies before it will send, so asking
     * anything else here would let an address through to a call that refuses
     * it — and the refusal would come back as an outage rather than as a fact
     * about the Lead.
     */
    public function accepts(string $address): bool
    {
        return is_email($address) !== false;
    }

    /**
     * Plain text, and no headers.
     *
     * `wp_mail()` defaults to `text/plain`, which is what the body field
     * collects: [[Playbook]] copy carries no markup (ADR 0013) and a merchant
     * typing into a textarea is writing a message, not HTML. A plain-text body
     * also means the `{link}` substitution cannot produce broken markup,
     * whatever was typed around it.
     */
    public function send(string $to, string $subject, string $body): bool
    {
        return wp_mail($to, $subject, $body);
    }
}
