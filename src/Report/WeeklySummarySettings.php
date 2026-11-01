<?php

namespace WConvert\Report;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * Whether the weekly summary email is on, and who gets it (ADR 0176).
 *
 * **One WordPress option, no table.** Two values that change a few times in a
 * site's life are a settings row, not a schema.
 *
 * **On by default, to the site's admin email.** An empty recipient list means
 * "the admin email as it is now", so changing the site's admin email moves the
 * summary with it. Saving exactly that address stores the empty list again.
 */
final class WeeklySummarySettings
{
    public const OPTION = 'wconvert_weekly_summary';

    /** Enough for an owner and a marketer or two; more is a mailing list. */
    public const MAX_RECIPIENTS = 5;

    public function __construct(private readonly OptionStore $options)
    {
    }

    public function enabled(): bool
    {
        $stored = $this->stored();

        return !in_array($stored['enabled'] ?? 1, [false, 0, '0', ''], true);
    }

    /**
     * The addresses that were typed, without the default filled in.
     *
     * @return list<string>
     */
    public function chosen(): array
    {
        $stored = $this->stored()['recipients'] ?? [];

        return is_array($stored) ? array_values(array_filter($stored, 'is_string')) : [];
    }

    /**
     * Who the summary goes to: the chosen addresses, else the admin email.
     *
     * @return list<string>
     */
    public function recipients(): array
    {
        $chosen = $this->chosen();

        if ($chosen !== []) {
            return $chosen;
        }

        $admin = $this->defaultRecipient();

        return $admin === '' ? [] : [$admin];
    }

    public function defaultRecipient(): string
    {
        $admin = $this->options->get('admin_email', '');

        return is_string($admin) ? trim($admin) : '';
    }

    /**
     * @param list<string> $recipients Already validated by {@see parse()}.
     */
    public function save(bool $enabled, array $recipients): void
    {
        // The default spelled out is the default: store nothing, so it follows.
        if (array_map('strtolower', $recipients) === [strtolower($this->defaultRecipient())]) {
            $recipients = [];
        }

        // Integers, not booleans: WordPress stores false as '' (see PrivacyGuidance).
        $this->options->set(self::OPTION, ['enabled' => $enabled ? 1 : 0, 'recipients' => array_values($recipients)]);
    }

    /**
     * Split a comma- or newline-separated list and sort it into good and bad.
     *
     * @param callable(string): bool $isEmail WordPress's `is_email()`, passed in so the rule is testable.
     * @return array{valid: list<string>, invalid: list<string>}
     */
    public static function parse(string $raw, callable $isEmail): array
    {
        $valid = [];
        $invalid = [];

        foreach (preg_split('/[\s,;]+/', $raw) ?: [] as $part) {
            $part = trim($part);

            if ($part === '') {
                continue;
            }

            if ($isEmail($part)) {
                if (!in_array(strtolower($part), array_map('strtolower', $valid), true)) {
                    $valid[] = $part;
                }
            } else {
                $invalid[] = $part;
            }
        }

        return ['valid' => $valid, 'invalid' => $invalid];
    }

    /** @return array<string, mixed> */
    private function stored(): array
    {
        $stored = $this->options->get(self::OPTION, []);

        return is_array($stored) ? $stored : [];
    }
}
