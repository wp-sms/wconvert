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
 * somebody can act on — and where the provider supplied one of their own, it
 * is **theirs, verbatim**. The WSMS push already stores failure text exactly
 * as WSMS wrote it and the admin renders it through React, which escapes on
 * the way to the DOM; rewriting a helpful provider message into a generic one
 * is the single most common way this feature is made useless.
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
 * differently.
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
        public readonly string $outcome,
        public readonly string $message,
    ) {
    }

    /**
     * What a push actually did, as a sentence.
     *
     * `$target` is what the Destination was pointed at — the list, the
     * audience, the tag — resolved to the merchant's own names by
     * {@see self::targetOf()}. Naming it is most of the value of a successful
     * test: *"it worked"* leaves a merchant who configured two Destinations no
     * wiser about which one they just proved.
     */
    public static function of(PushResult $result, string $destination, string $target = ''): self
    {
        if ($result->outcome === PushOutcome::Skipped) {
            // A skip carries its own reason and it is already a sentence — the
            // dispatcher's *"this Destination's type is not available on this
            // site"*, or a type's own *"the Lead carries no email address"*.
            return new self('skipped', (string) $result->reason);
        }

        if ($result->isFailure()) {
            return new self('failed', (string) $result->reason);
        }

        if ($target === '') {
            return new self('success', sprintf(
                /* translators: %s: the merchant's name for a destination. */
                __('The test reached %s.', 'wconvert'),
                $destination
            ));
        }

        return new self('success', sprintf(
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
        return new self('success', sprintf(
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
        return new self('skipped', __(
            'This destination has no credentials to check — it runs on this site. Use “Send a test” to prove it works.',
            'wconvert'
        ));
    }

    public static function failed(string $error): self
    {
        return new self('failed', $error);
    }

    /**
     * **Nowhere to send it**, which is a question rather than a fault.
     *
     * The address defaults to the pressing merchant's own, and a WordPress
     * account is allowed to have none — a CLI or cron context has no user at
     * all. Left unguarded the merchant would read a type's own *"the Lead
     * carries no email address"*, which is true, internal, and says nothing
     * about the button they just pressed (ADR 0042).
     */
    public static function noAddress(): self
    {
        return new self('skipped', __(
            'There is no address to send the test to. Add one to your WordPress profile, or give one here.',
            'wconvert'
        ));
    }

    /**
     * What a Destination is pointed at, in the merchant's own words.
     *
     * ========================================================================
     * READ OFF THE SCHEMA, SO NO TYPE HAS TO DECLARE IT.
     * ========================================================================
     * A type's `settingsSchema()` already says which fields select a target and
     * — for the ones that could enumerate them — what each option is CALLED.
     * So *"landed on Newsletter"* falls out of what is already there, and a
     * type that ships tomorrow gets it without implementing anything. The
     * alternative was a `describeTarget()` on {@see DestinationType}, which is
     * a method for one screen on an interface that deliberately has no
     * `Supports*` split (#4).
     *
     * A field whose options the provider could not enumerate — WSMS's tags,
     * which are the merchant's own strings — falls back to the stored ids,
     * which is what a merchant typed and therefore still reads as their words.
     * A field that selects nothing (the lead-magnet email's URL and subject)
     * has no options and is not a list, so it contributes nothing and the
     * sentence is the short one.
     *
     * @param array<string, mixed> $schema
     * @param array<string, mixed> $settings
     */
    public static function targetOf(array $schema, array $settings): string
    {
        $named = [];

        foreach ($schema as $key => $field) {
            if (!is_array($field) || ($field['type'] ?? null) !== 'ids') {
                continue;
            }

            $chosen = $settings[$key] ?? [];
            $labels = self::labels($field);

            foreach (is_array($chosen) ? $chosen : [] as $id) {
                if (is_string($id) && $id !== '') {
                    $named[] = $labels[$id] ?? $id;
                }
            }
        }

        return implode(', ', $named);
    }

    /**
     * One field's option ids mapped to their labels, or `[]` where the
     * provider could not enumerate them.
     *
     * @param array<string, mixed> $field
     * @return array<string, string>
     */
    private static function labels(array $field): array
    {
        $labels = [];

        foreach (is_array($field['options'] ?? null) ? $field['options'] : [] as $option) {
            if (is_array($option) && isset($option['value'], $option['label'])) {
                $labels[(string) $option['value']] = (string) $option['label'];
            }
        }

        return $labels;
    }

    /**
     * @return array{outcome: string, message: string}
     */
    public function toArray(): array
    {
        return ['outcome' => $this->outcome, 'message' => $this->message];
    }
}
