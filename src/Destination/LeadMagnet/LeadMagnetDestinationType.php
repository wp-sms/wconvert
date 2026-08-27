<?php

namespace WConvert\Destination\LeadMagnet;

use WConvert\Destination\CanonicalFields;
use WConvert\Destination\DestinationType;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Lead\Lead;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The lead-magnet delivery — **the one [[Destination]] type that works on a
 * [[Standalone]] install.**
 *
 * Every other type reaches something: WSMS reaches a plugin that may not be
 * installed, and Pro's ESPs reach the network. This one reaches `wp_mail()`,
 * which every WordPress has. That is what makes the **Deliver a lead magnet**
 * [[Goal]] a Goal a merchant can actually complete out of the box rather than
 * one that captures [[Lead]]s and sends nothing (CONTEXT.md, Standalone;
 * ADR 0007).
 *
 * ============================================================================
 * THE EMAIL CARRIES A LINK, NEVER AN ATTACHMENT.
 * ============================================================================
 * Three reasons, and the first is sufficient on its own:
 *
 * - `wp_mail()`'s `$attachments` takes **absolute server paths**, and WConvert
 *   has no media-library integration at all — there is nothing anywhere in
 *   this plugin that turns a merchant's choice into a path on disk.
 * - Pushing a large PDF through `wp_mail()` on shared hosting is a
 *   deliverability and a memory hazard at once: the attachment is base64'd
 *   into the message body in PHP's memory, and mailbox providers score
 *   attachments from unknown senders harshly.
 * - A link is what the merchant's own file host is for, and it keeps the
 *   download revocable after the fact.
 *
 * **One `{link}` token, and no placeholder language.** It is substituted where
 * the body contains it and APPENDED where it does not, so there is nothing a
 * merchant can get wrong — a body that never mentions the token still arrives
 * with the download in it. That matters because there is nothing to validate
 * it against on the way in: `DestinationController::store()` stores settings
 * opaquely, so this class defends itself at push time the way
 * {@see \WConvert\Destination\Wsms\WsmsDestinationType::applyTags()} re-checks
 * `is_array`/`is_string` over the same opaque bag.
 *
 * **No `__()` in the constructor**, which is a rule about WHEN rather than
 * about whether. `CoreServiceProvider::boot()` runs on `plugins_loaded` and
 * resolves `PushWorker`, which constructs every registered type — before
 * `init`, where WordPress refuses to translate (#52). Every other method here
 * is called from a REST read or from a queued job, both of which are long past
 * `init`.
 *
 * @since 0.1.0
 */
final class LeadMagnetDestinationType implements DestinationType
{
    /**
     * **Already reserved by a shipped fixture.**
     * `resources/playbooks/guide-download.php` declares
     * `'destination_hint' => ['types' => ['lead_magnet_email'], …]`, so this
     * id was fixed before the type existed and changing it would silently
     * un-hint the one Playbook that points at it.
     */
    public const ID = 'lead_magnet_email';

    /** Where the merchant's file lives. */
    public const FILE_URL = 'file_url';

    /** The subject line. */
    public const SUBJECT = 'subject';

    /** The message. {@see self::LINK} is substituted into it, or appended. */
    public const BODY = 'body';

    /** The one token. See the class docblock for why there is exactly one. */
    public const LINK = '{link}';

    public function __construct(
        private readonly Mailer $mailer,
    ) {
    }

    public function id(): string
    {
        return self::ID;
    }

    public function label(): string
    {
        return __('Lead magnet email', 'wconvert');
    }

    public function icon(): string
    {
        return 'mail';
    }

    public function tier(): Tier
    {
        return Tier::Free;
    }

    /**
     * **Nothing**, and it is the only type that can say so honestly. See the
     * class docblock: `wp_mail()` is WordPress's, so there is no plugin to be
     * missing and no `unavailable` state to explain (ADR 0026).
     */
    public function requires(): ?SiteDependency
    {
        return null;
    }

    /**
     * None. `wp_mail()` authenticates against nothing — whatever the site has
     * put behind it did its own authenticating long before this call.
     */
    public function connectionSchema(): ?array
    {
        return null;
    }

    /**
     * Three fields, and none of their options comes off the wire.
     *
     * That is the one place this type differs from an ESP's schema and it is
     * the same difference the WSMS push has: there is no remote system to ask.
     * The method still earns its place — it is what tells the admin these
     * fields exist at all, which is the collapse that removes WSMS's five
     * `Supports*` capability interfaces (#4).
     *
     * `multiline` is a new control kind, and `resources/admin/src/destinations`
     * renders the schema rather than one hard-coded field as of #31. An
     * unknown `type` falls back to a text input, so a future field is a
     * degraded control rather than an invisible one.
     *
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function settingsSchema(array $credentials): array
    {
        unset($credentials);

        return [
            self::FILE_URL => [
                'type' => 'url',
                'label' => __('Link to the file', 'wconvert'),
                'description' => __(
                    'The email carries this link rather than an attachment, so the file stays yours to move or revoke.',
                    'wconvert'
                ),
            ],
            self::SUBJECT => [
                'type' => 'text',
                'label' => __('Subject line', 'wconvert'),
                'description' => __('What the email says it is, in the inbox.', 'wconvert'),
            ],
            self::BODY => [
                'type' => 'multiline',
                'label' => __('Message', 'wconvert'),
                // The token is interpolated rather than written into the
                // string. A translator who localises `{link}` breaks
                // substitution silently — the body would simply arrive with
                // the URL appended and the merchant's placement ignored — and
                // {@see self::LINK} would stop being the one place it is
                // spelled.
                'description' => sprintf(
                    /* translators: %s: the literal token {link}, which must not be translated. */
                    __(
                        'Write %s where the download should go. Leave it out and the link is added at the end.',
                        'wconvert'
                    ),
                    self::LINK
                ),
            ],
        ];
    }

    /**
     * Nothing to prove. There is no [[Connection]] under this type.
     *
     * @param array<string, mixed> $credentials
     */
    public function testConnection(array $credentials): void
    {
        unset($credentials);
    }

    /**
     * Send the lead magnet.
     *
     * ========================================================================
     * THE DECISION TABLE, ARGUED AGAINST ADR 0008 RATHER THAN GUESSED.
     * ========================================================================
     * ADR 0008's criterion is not "how bad is it" — it is **whose fault it is**:
     * a failure about the DESTINATION is an outage and moves health, a failure
     * about this LEAD is terminal and is invisible to health.
     *
     * | Situation                    | Result      | Why                                                                  |
     * |------------------------------|-------------|----------------------------------------------------------------------|
     * | The Lead carries no email    | `skipped`   | {@see \WConvert\Destination\PushOutcome::Skipped} names this exact case. Routine, and it must stay out of the health count. |
     * | No file configured           | `retryable` | About the DESTINATION, not this Lead — ADR 0008's own criterion.       |
     * | `wp_mail()` false, or throws | `retryable` | A mail transport that is down is an outage, and the next Lead hits it too. |
     * | The address is unusable      | `terminal`  | Lead-specific. Near-vacuous, and documented as such.                   |
     *
     * **"No file configured" is the row worth reading twice.** It looks like a
     * configuration error to fail permanently on, and it is exactly the
     * opposite: a merchant who published the Optin before finishing the
     * Destination gets attempts spread over the backoff window instead of a
     * queue of Leads that will never be retried, and health then says *"N
     * failures in a row: no lead magnet file is configured"* on the one screen
     * built to tell them pushing is broken. Terminal here would put those
     * Leads in a ring nothing prompts anyone to read.
     *
     * **The address never appears in a failure reason.** A terminal failure is
     * recorded in {@see \WConvert\Destination\DeliveryFailures}, an option that
     * outlives WConvert's own retention policy — so personal data in it would
     * be personal data with no expiry (ADR 0008, ADR 0018). The reason names
     * what happened and the ring already holds the Lead's id.
     *
     * **Idempotent, as the interface requires** — and by construction rather
     * than by a flag. `send()` takes one address, one subject and one body
     * derived only from the Lead and the settings, so running it twice sends
     * the same email twice. That is a re-send and never a duplicate record;
     * there is no remote object to double up, which is what "idempotent" is
     * protecting in every other type. What it does NOT protect is the
     * merchant's inbox impression — a bulk re-push on this Destination
     * genuinely re-sends, and that seam is recorded in ADR 0008 rather than
     * hidden.
     */
    public function push(Lead $lead, PushContext $context): PushResult
    {
        $email = CanonicalFields::of($lead)[CanonicalFields::EMAIL] ?? null;

        if ($email === null) {
            return PushResult::skipped('The Lead carries no email address, and the lead magnet goes out by email.');
        }

        $link = $this->setting($context, self::FILE_URL);

        if ($link === '') {
            return PushResult::retryable('No lead magnet file is configured on this Destination.');
        }

        if (!$this->mailer->accepts($email)) {
            return PushResult::terminal('WordPress will not send to this Lead’s email address.');
        }

        try {
            $sent = $this->mailer->send($email, $this->subject($context), $this->body($context, $link));
        } catch (\Throwable $failure) {
            return PushResult::retryable($failure->getMessage());
        }

        // No `providerRef`: `wp_mail()` returns a boolean and the site's
        // transport keeps whatever id it minted to itself. Inventing one would
        // be a value nothing can look up (ADR 0008).
        return $sent
            ? PushResult::success()
            : PushResult::retryable('The site’s mail transport refused the message.');
    }

    /**
     * Six a minute, and the figure is about the HOST rather than about us.
     *
     * Nothing here rate-limits: this is read only by
     * {@see \WConvert\Destination\BulkRePush}'s stagger, and organic capture
     * cannot approach it (ADR 0008). What it is sized against is the outbound
     * mail quota of ordinary shared hosting — commonly a few hundred messages
     * an hour — because bulk re-push on THIS type is the one place in WConvert
     * that can empty such a quota in a minute and get the site's mail cut off
     * for the rest of the hour. It is deliberately the lowest figure any type
     * declares.
     */
    public function throughput(): int
    {
        return 6;
    }

    /**
     * The subject, or a plain one where the merchant left it blank.
     *
     * A default rather than a failure: an unset subject is not worth withholding
     * somebody's download over, and an email with an empty subject line reads
     * as spam to both the recipient and their provider.
     */
    private function subject(PushContext $context): string
    {
        $subject = $this->setting($context, self::SUBJECT);

        return $subject === '' ? __('Your download', 'wconvert') : $subject;
    }

    /**
     * The message with the link in it — **substituted, or appended.**
     *
     * See the class docblock: one token, and a body that never mentions it
     * still arrives with the download in it.
     */
    private function body(PushContext $context, string $link): string
    {
        $body = $this->setting($context, self::BODY);

        if ($body === '') {
            $body = __('Here is the download you asked for.', 'wconvert');
        }

        return str_contains($body, self::LINK)
            ? str_replace(self::LINK, $link, $body)
            : $body . "\n\n" . $link;
    }

    /**
     * One setting as a trimmed string, however it was stored.
     *
     * `settings` is an opaque bag — `DestinationController::store()` validates
     * nothing in it — so every read of it defends itself here rather than
     * trusting the write path, which is the same posture `applyTags()` takes.
     */
    private function setting(PushContext $context, string $key): string
    {
        $value = $context->settings[$key] ?? null;

        return is_string($value) ? trim($value) : '';
    }
}
