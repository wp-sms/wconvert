<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * The answer a [[Destination]] gives to one push.
 *
 * **`retryable` is set by the Destination and never derived from an HTTP
 * status**, which is contract rather than convention: the ESP survey found
 * Mailchimp packing four terminal cases into one `400` while a bodyless `403`
 * genuinely is retryable, so a caller reading the status code would retry the
 * unfixable and give up on the transient. Only the implementation knows which
 * of its own failures is which (ADR 0008).
 *
 * That flag is also what separates the two halves of the failure model. A
 * `retryable` failure is an OUTAGE and moves {@see DestinationHealth}; a
 * terminal one is [[Lead]]-specific — a malformed address, a compliance
 * rejection — and is invisible to health, landing in
 * {@see DeliveryFailures} instead. Inverting that is the mistake ADR 0008
 * exists to prevent: a hundred bad addresses would read as a hundred
 * consecutive outages.
 *
 * `providerRef` is whatever the remote system calls the thing that now exists.
 * There is no per-[[Lead]] delivery row to hang it on and there is not going
 * to be one, so it travels for logging and for the job that just ran, and is
 * not stored (ADR 0008).
 *
 * `httpStatus` and `durationMs` are what a transport answered, for the test
 * screen's second line ("Answered 200 in 0.4 s"). Set only by a type that
 * makes one request per push, through {@see self::withTransport()}, and never
 * read to decide anything — `retryable` above is still the only verdict.
 *
 * @since 0.1.0
 */
final class PushResult
{
    private function __construct(
        public readonly PushOutcome $outcome,
        public readonly ?string $providerRef,
        public readonly ?string $reason,
        public readonly bool $retryable,
        public readonly bool $needsAttention = false,
        public readonly ?int $httpStatus = null,
        public readonly ?int $durationMs = null,
    ) {
    }

    /** This result, with what the request answered and how long it took. A transport error has no status. */
    public function withTransport(?int $status, int $ms): self
    {
        return new self($this->outcome, $this->providerRef, $this->reason, $this->retryable, $this->needsAttention, $status, $ms);
    }

    /**
     * It landed. `$providerRef` is the remote id, where the vendor gives one.
     */
    public static function success(?string $providerRef = null): self
    {
        return new self(PushOutcome::Success, $providerRef, null, false);
    }

    /**
     * There was nothing to send — and that is an ordinary outcome, not a
     * failure. See {@see PushOutcome::Skipped}.
     */
    public static function skipped(string $why): self
    {
        return new self(PushOutcome::Skipped, null, $why, false);
    }

    /**
     * The vendor is having a bad time: a timeout, a 500, a revoked key.
     * Retrying the whole of `push()` is safe, because `push()` is idempotent
     * — for a webhook, because every attempt carries one `deliveryId` for the
     * receiver to dedupe on (ADR 0148).
     */
    public static function retryable(string $error): self
    {
        return new self(PushOutcome::Failed, null, $error, true);
    }

    /**
     * This Lead will never land at this Destination, however many times it is
     * tried. Invisible to health, and recorded in the failure ring.
     */
    public static function terminal(string $error): self
    {
        return new self(PushOutcome::Failed, null, $error, false);
    }

    /** Account or route needs merchant repair; automatic retries cannot fix it. */
    public static function attention(string $error): self
    {
        return new self(PushOutcome::Failed, null, $error, false, true);
    }

    public function isFailure(): bool
    {
        return $this->outcome === PushOutcome::Failed;
    }
}
