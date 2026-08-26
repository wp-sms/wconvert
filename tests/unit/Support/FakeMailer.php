<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Destination\LeadMagnet\Mailer;

/**
 * A mailer that records instead of sending, and answers what a test told it
 * to.
 *
 * It exists because `wp_mail()` is not stubbed in `tests/bootstrap.php` and a
 * call to it fatals here — which is the bootstrap's stated rule rather than an
 * accident: *"a class that needs more of WordPress than this is a class whose
 * WordPress touchpoints should have been passed in"*.
 *
 * {@see self::$accepts} and {@see self::$sends} are separate on purpose. They
 * are the two DIFFERENT kinds of failure ADR 0008 turns on — a refused address
 * is Lead-specific and terminal, a refused message is an outage — and a fake
 * that collapsed them into one flag could not exercise the distinction the
 * type exists to draw.
 */
final class FakeMailer implements Mailer
{
    /** What {@see self::accepts()} answers. */
    public bool $accepts = true;

    /** What {@see self::send()} returns, where it does not throw. */
    public bool $sends = true;

    /** Thrown by {@see self::send()} when set — a transport that is broken rather than merely refusing. */
    public ?\Throwable $throws = null;

    /** @var list<array{to: string, subject: string, body: string}> Every message it was asked to send. */
    public array $sent = [];

    public function accepts(string $address): bool
    {
        return $this->accepts;
    }

    public function send(string $to, string $subject, string $body): bool
    {
        if ($this->throws !== null) {
            throw $this->throws;
        }

        $this->sent[] = ['to' => $to, 'subject' => $subject, 'body' => $body];

        return $this->sends;
    }
}
