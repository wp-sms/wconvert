<?php

namespace WConvert\Pro\Module\Destinations;

use WConvert\Destination\CanonicalFields;
use WConvert\Destination\ConnectionRefused;
use WConvert\Destination\DeclaresRetrySchedule;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\DestinationType;
use WConvert\Destination\ForwardsWholeSubmission;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushSubject;
use WConvert\Support\Docs;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * **A signed JSON POST of each accepted submission** to a URL the merchant
 * pastes — Zapier, Make, n8n, or their own code.
 *
 * ========================================================================
 * THE URL IS A CREDENTIAL.
 * ========================================================================
 * A Zapier catch hook or a Make webhook authenticates by nothing but being
 * secret: whoever has the URL can post leads into the merchant's CRM. So it
 * lives on the [[Connection]], which REST never returns, and not in the
 * Destination's settings, which it does. The Connection also holds the signing
 * secret and up to five custom headers (`x-make-apikey`, n8n's Header Auth),
 * which is how a no-code receiver that ignores signatures still authenticates
 * the request (ADR 0148).
 *
 * **Not idempotent, and it says so.** An ESP push upserts by email; a POST
 * cannot be made idempotent from this side. Every attempt for one submission
 * and one route carries the same `webhook-id`, in the header and in the body,
 * and the receiver dedupes on it (ADR 0008, amended).
 *
 * One POST per accepted submission, each a full snapshot: a two-step
 * email→SMS signup posts twice with one `lead_id`, and the second carries both.
 *
 * @since 0.1.0
 */
final class WebhookDestinationType implements DestinationType, DeclaresRetrySchedule, ForwardsWholeSubmission
{
    public const EVENT = 'lead.captured';

    public const VERSION = 1;

    /** Lets a developer point a webhook at their own machine. Off by default. */
    public const ALLOW_PRIVATE_FILTER = 'wconvert_webhook_allows_private_hosts';

    /** Headers the merchant may not set: the signature's, and the request's own framing. */
    public const RESERVED_HEADERS = ['webhook-id', 'webhook-timestamp', 'webhook-signature', 'content-type', 'content-length',
        'host', 'user-agent', 'x-wconvert-event', 'transfer-encoding', 'connection'];

    private readonly WebhookUrlGuard $guard;

    public function __construct(?WebhookUrlGuard $guard = null)
    {
        $this->guard = $guard ?? new WebhookUrlGuard();
    }

    public function id(): string { return 'webhook'; }
    public function label(): string { return __('Webhook', 'wconvert'); }
    public function icon(): string { return 'webhook'; }
    public function tier(): Tier { return Tier::Pro; }
    public function requires(): ?\WConvert\Support\SiteDependency { return null; }
    /** One POST per job. The figure only paces bulk re-push, where each lead may cost the merchant a Zapier task. */
    public function throughput(): int { return 60; }

    /** +1m, +5m, +30m, +2h, +6h, +24h: seven attempts over about a day, because a receiver is down for hours rather than minutes. */
    public function retryDelays(): array { return [60, 300, 1800, 7200, 21600, 86400]; }

    /** @return array<string, mixed> */
    public function connectionSchema(): array
    {
        return [
            'url' => ['type' => 'url', 'label' => __('Webhook URL', 'wconvert')],
            // Shown once, with this line and the guide, by free's generic secret panel.
            'signing_secret' => ['type' => 'secret', 'label' => __('Signing secret', 'wconvert'), 'prefix' => 'whsec_',
                'description' => __('Zapier, Make and n8n don’t check it.', 'wconvert'), 'guide' => Docs::url(Docs::WEBHOOKS, 'verify-the-signature')],
            'headers' => ['type' => 'headers', 'label' => __('Custom headers', 'wconvert'), 'optional' => true, 'max' => 5,
                'reserved' => self::RESERVED_HEADERS],
            // The site this Connection was made on, so a staging copy of it can say so.
            'setup_site_url' => ['type' => 'site_url'],
        ];
    }

    /** No body template and no field mapping: the payload is one documented shape (ADR 0148). */
    public function settingsSchema(array $credentials): array { return []; }

    public function requirements(): DestinationRequirements
    {
        return new DestinationRequirements([CanonicalFields::EMAIL, CanonicalFields::PHONE], [],
            [CanonicalFields::EMAIL, CanonicalFields::PHONE, CanonicalFields::NAME, CanonicalFields::INTEREST], audienceChannels: ['email', 'phone']);
    }

    /**
     * The URL and the secret, checked here and never by sending: a test POST
     * to a Zap would become its first sample, and the merchant's real one
     * would have to replace it.
     */
    public function testConnection(array $credentials): void
    {
        $refusal = self::refusalMessage($this->guard->refusal((string) ($credentials['url'] ?? ''), self::allowsPrivate()));
        if ($refusal !== null) throw new ConnectionRefused($refusal); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- rendered through React, which escapes.
        if (!WebhookSignature::isSecret((string) ($credentials['signing_secret'] ?? ''))) throw new ConnectionRefused(__('This webhook has no valid signing secret. Generate a new one.', 'wconvert'));
    }

    /** The host, which is what a merchant recognises: `hooks.zapier.com`.
     * @param array<string, mixed> $credentials
     */
    public function accountIdentity(array $credentials): string
    {
        $host = wp_parse_url((string) ($credentials['url'] ?? ''), PHP_URL_HOST);
        if (!is_string($host) || $host === '') throw new \RuntimeException('Webhook URL has no host.');
        return strtolower($host);
    }

    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $url = (string) ($context->credentials['url'] ?? '');
        $secret = (string) ($context->credentials['signing_secret'] ?? '');
        $refusal = $this->guard->refusal($url, self::allowsPrivate());
        if ($refusal === WebhookUrlGuard::UNRESOLVED) return PushResult::retryable(__('The webhook’s host could not be found. Sending will retry.', 'wconvert'));
        if ($refusal !== null) return PushResult::attention((string) self::refusalMessage($refusal));
        if (!WebhookSignature::isSecret($secret)) return PushResult::attention(__('This webhook has no valid signing secret. Generate a new one.', 'wconvert'));
        if ($subject->deliveryId === '') return PushResult::terminal(__('This submission has no delivery id.', 'wconvert'));

        // Encoded once: the signature covers these exact bytes.
        $body = (string) wp_json_encode(WebhookPayload::of($subject, $context, home_url(), wp_get_environment_type()), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $timestamp = time();
        $headers = [];
        foreach (is_array($context->credentials['headers'] ?? null) ? $context->credentials['headers'] : [] as $header) {
            $name = is_array($header) ? (string) ($header['name'] ?? '') : '';
            if ($name !== '' && !in_array(strtolower($name), self::RESERVED_HEADERS, true)) $headers[$name] = (string) ($header['value'] ?? '');
        }
        $headers = [
            'Content-Type' => 'application/json',
            'User-Agent' => 'WConvert/' . WCONVERT_VERSION,
            'X-WConvert-Event' => self::EVENT,
            'webhook-id' => $subject->deliveryId,
            'webhook-timestamp' => (string) $timestamp,
            'webhook-signature' => WebhookSignature::sign($secret, $subject->deliveryId, $timestamp, $body),
        ] + $headers;

        $started = hrtime(true);
        $response = wp_remote_post($url, ['body' => $body, 'headers' => $headers, 'timeout' => 10, 'redirection' => 0, 'sslverify' => true, 'data_format' => 'body']);
        $ms = intdiv(hrtime(true) - $started, 1_000_000);
        if ($response instanceof \WP_Error) return self::transportFailure($response->get_error_message())->withTransport(null, $ms);
        // The body is never read: a receiver's reply is not ours to store.
        $status = (int) wp_remote_retrieve_response_code($response);
        return self::outcome($status)->withTransport($status, $ms);
    }

    /** What a receiver's status means. Bodies differ by receiver and none of them is shown. */
    public static function outcome(int $status): PushResult
    {
        if ($status >= 200 && $status < 300) return PushResult::success();
        if ($status >= 300 && $status < 400) return PushResult::attention(__('The webhook URL redirects. Paste the address it redirects to.', 'wconvert'));
        if ($status === 401) return PushResult::attention(__('The receiver refused the request. Check the webhook’s key or headers.', 'wconvert'));
        if ($status === 403) return PushResult::attention(__('The receiver or its firewall blocked the request. Check its key, headers or bot protection.', 'wconvert'));
        if ($status === 404 || $status === 410) return PushResult::attention(__('The receiver no longer accepts this URL. The Zap or scenario may be off or deleted.', 'wconvert'));
        if ($status === 408 || $status === 429 || $status >= 500) return PushResult::retryable(__('The receiver is temporarily unavailable. Sending will retry.', 'wconvert'));
        return PushResult::terminal(__('The receiver rejected this submission.', 'wconvert'));
    }

    /** A transport error: a bad certificate needs the merchant; anything else is an outage. */
    private static function transportFailure(string $error): PushResult
    {
        if (preg_match('/certificate|cURL error (51|58|60|77)\b/i', $error) === 1) {
            return PushResult::attention(__('The receiver’s security certificate is invalid. Fix it on the receiver; WConvert only sends over a valid one.', 'wconvert'));
        }
        return PushResult::retryable(__('The receiver could not be reached. The result may be uncertain.', 'wconvert'));
    }

    /** A guard refusal in the merchant's words, or null where there is none. */
    private static function refusalMessage(?string $refusal): ?string
    {
        return match ($refusal) {
            WebhookUrlGuard::INVALID => __('Enter a full webhook URL starting with https:// or http://.', 'wconvert'),
            WebhookUrlGuard::PRIVATE => __('This URL points at a private or local network address, which WConvert does not send to.', 'wconvert'),
            WebhookUrlGuard::UNRESOLVED => __('This URL’s host could not be found. Check the address.', 'wconvert'),
            default => null,
        };
    }

    private static function allowsPrivate(): bool
    {
        return (bool) apply_filters(self::ALLOW_PRIVATE_FILTER, false);
    }
}
