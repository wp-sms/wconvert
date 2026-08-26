<?php

namespace WConvert\Destination\LeadMagnet;

defined('ABSPATH') || exit;

/**
 * The two mail operations the lead-magnet delivery uses, and no others.
 *
 * It is an interface for the ordinary reason: `wp_mail()` is not stubbed in
 * `tests/bootstrap.php` and a call to it fatals in the unit suite. The
 * bootstrap's own header states the rule — *"a class that needs more of
 * WordPress than this is a class whose WordPress touchpoints should have been
 * passed in"* — and this is the same shape
 * {@see \WConvert\Destination\Wsms\WsmsContacts} has over WSMS.
 *
 * **{@see self::accepts()} is here rather than inside `send()`**, and that is
 * the design rather than a convenience. The two answers are different KINDS of
 * failure and only this seam can tell them apart: an address WordPress will
 * not accept is [[Lead]]-specific and terminal, while a transport that refuses
 * a message it accepted the address for is an outage. Collapsing them into one
 * boolean is what turns a hundred bad addresses into a hundred consecutive
 * outages, which is the inversion ADR 0008 exists to prevent.
 *
 * There is no `attach`, no `headers` and no `from`. The email carries a LINK
 * (see {@see LeadMagnetDestinationType::settingsSchema()}), and a method
 * absent from this interface is a thing the implementation cannot do by
 * accident.
 *
 * @since 0.1.0
 */
interface Mailer
{
    /**
     * Would this address be accepted at all?
     *
     * **Near-vacuous by construction, and kept anyway.**
     * {@see \WConvert\Lead\Identifier::email()} already refuses at capture
     * anything `filter_var` rejects — and it is the STRICTER of the two
     * checks, so an address that reached storage passes this one in practice.
     * What it buys is that the one Lead-specific terminal branch is expressed
     * rather than assumed, exactly as
     * {@see \WConvert\Destination\Wsms\WsmsDestinationType} documents its own.
     */
    public function accepts(string $address): bool;

    /**
     * Send one message, in plain text.
     *
     * @return bool False where the transport refused it — which is an OUTAGE
     *              and not a fact about this Lead. See the class docblock.
     * @throws \Throwable Whatever a broken transport raises; the caller treats
     *                    it as the same outage.
     */
    public function send(string $to, string $subject, string $body): bool;
}
