<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * **What a merchant is told when they press *Test*.**
 *
 * ========================================================================
 * A SENTENCE, NEVER A STATUS CODE.
 * ========================================================================
 * ADR 0042: the admin speaks only when it changes what you do next, and a red
 * box saying `500` changes nothing. So the unit this produces is a sentence
 * somebody can act on — and where the provider supplied one of their own, its
 * actionable explanation remains intact. Before a message reaches an admin
 * response or stored health record, the boundary removes submitted personal
 * values, credentials and control characters. Rewriting every useful provider
 * reason into one generic sentence would make the feature useless.
 *
 * ========================================================================
 * THREE OUTCOMES, NOT A BOOLEAN.
 * ========================================================================
 * A [[Destination]] whose type is not available here **cannot run and has not
 * failed**. Collapsing that into `ok: false` would tell a merchant with no WP
 * SMS that their WP SMS Destination is broken, when what is true is that the
 * plugin is not installed — the same distinction [[Availability]] draws
 * between `locked` and `unavailable`, and the same reason it is not one word
 * (ADR 0026). So the three states travel, and the screen renders each
 * differently. The three are {@see PushOutcome}'s own cases rather than
 * strings of this class's, because they are the same three answers a push
 * gives and a second spelling is a fourth state waiting to be added to one of
 * them.
 *
 * **It records nothing and can record nothing**, because it holds nothing to
 * record with. Delivery state is about [[Lead]]s that were captured (ADR 0008)
 * and a test captured none; a merchant pressing this four times while fixing a
 * key must not walk away with a Destination marked unhealthy.
 *
 * @since 0.1.0
 */
final class TestReport
{
    private function __construct(
        public readonly PushOutcome $outcome,
        public readonly string $message,
    ) {
    }

    /**
     * What a push actually did, as a sentence.
     *
     * `$target` is what the Destination was pointed at — the list, the
     * audience, the tag — resolved to the merchant's own names by
     * {@see ConfiguredTarget}. Naming it is most of the value of a successful
     * test: *"it worked"* leaves a merchant who configured two Destinations no
     * wiser about which one they just proved.
     */
    public static function of(PushResult $result, string $destination, string $target = ''): self
    {
        if ($result->outcome === PushOutcome::Skipped) {
            // A skip carries its own reason and it is already a sentence — the
            // dispatcher's *"this Destination's type is not available on this
            // site"*, or a type's own *"the Lead carries no email address"*.
            return new self(PushOutcome::Skipped, (string) $result->reason);
        }

        if ($result->isFailure()) {
            return new self(PushOutcome::Failed, (string) $result->reason);
        }

        if ($target === '') {
            return new self(PushOutcome::Success, sprintf(
                /* translators: %s: the merchant's name for a destination. */
                __('The test reached %s.', 'wconvert'),
                $destination
            ));
        }

        return new self(PushOutcome::Success, sprintf(
            /* translators: 1: the merchant's name for a destination, 2: what it was pointed at, such as a list name. */
            __('The test reached %1$s, and landed on %2$s.', 'wconvert'),
            $destination,
            $target
        ));
    }

    /**
     * The answer to *are these credentials good* — which is a different
     * question from whether a push lands, and worth its own button.
     *
     * {@see DestinationType::testConnection()} throws or says nothing, which
     * is the convention `IntegrationInterface::connect()` set rather than a
     * second one invented here.
     */
    public static function connected(string $destination): self
    {
        return new self(PushOutcome::Success, sprintf(
            /* translators: %s: the merchant's name for a destination. */
            __('%s accepted the credentials.', 'wconvert'),
            $destination
        ));
    }

    /**
     * **A type with no [[Connection]] has nothing to check, and saying so is
     * the honest answer rather than a green tick.**
     *
     * Every free type is in this state: the WSMS push, the MailPoet push and
     * the lead-magnet email all authenticate against nothing, because there is
     * no key to paste. Reporting success there would teach a merchant that the
     * button means *"this works"*, which is what the other button is for.
     */
    public static function nothingToConnectTo(): self
    {
        return new self(PushOutcome::Skipped, __(
            'This destination has no credentials to check — it runs on this site. Use “Send a test” to prove it works.',
            'wconvert'
        ));
    }

    public static function failed(string $error): self
    {
        return new self(PushOutcome::Failed, $error);
    }

    /**
     * **A type this install cannot run**, which is the third state and not a
     * failure.
     *
     * Beside {@see self::nothingToConnectTo()} rather than assembled from a
     * fabricated {@see PushResult} at the call site: both buttons answer this
     * situation, and one of them never reaches a push at all.
     */
    public static function unavailable(): self
    {
        return new self(PushOutcome::Skipped, PushDispatcher::unavailableHere());
    }

    /**
     * @return array{outcome: string, message: string}
     */
    public function toArray(): array
    {
        return ['outcome' => $this->outcome->value, 'message' => $this->message];
    }
}
