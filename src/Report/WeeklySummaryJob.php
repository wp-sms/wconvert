<?php

namespace WConvert\Report;

use WConvert\Milestone\MilestoneStore;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;

defined('ABSPATH') || exit;

/**
 * Sends the weekly summary on Monday mornings in site time (ADR 0176).
 *
 * The same shape as {@see \WConvert\Retention\LeadPruner}: one WP-Cron event,
 * scheduled on `init`, cleared on deactivation.
 *
 * **What it skips:** a week when the summary is switched off, any week before
 * the first publish, and a week when nothing was shown. A summary of zeros
 * teaches an owner to ignore the next one.
 */
final class WeeklySummaryJob
{
    public const HOOK = 'wconvert_weekly_summary';

    /** Monday, 09:00 site time. */
    public const SEND_HOUR = 9;

    public const SENT = 'sent';

    public const FAILED = 'failed';

    public const OFF = 'off';

    public function __construct(
        private readonly Dashboard $dashboard,
        private readonly MilestoneStore $milestones,
        private readonly WeeklySummarySettings $settings,
        private readonly SummaryMailer $mailer,
    ) {
    }

    /**
     * The job, with its Dashboard, is built when the send fires rather than on
     * every request (#395). Scheduling needs none of it.
     *
     * @param \Closure(): self $job
     */
    public static function hooks(\Closure $job): void
    {
        add_action(self::HOOK, static function () use ($job): void {
            $job()->run();
        });

        // On `init`, for the reason LeadPruner gives: wp_get_schedules() runs
        // filters other plugins translate, which is too early on plugins_loaded.
        add_action('init', [self::class, 'schedule']);
    }

    public static function schedule(): void
    {
        if (wp_next_scheduled(self::HOOK) === false) {
            wp_schedule_event(self::nextSend(time(), wp_timezone()), 'weekly', self::HOOK);
        }
    }

    /**
     * The next Monday at {@see SEND_HOUR} in the site's zone, strictly after `$now`.
     *
     * WP-Cron's `weekly` recurrence is a fixed seven days, so a clock change
     * moves later sends by an hour; Settings names the time zone rather than
     * promising the hour.
     */
    public static function nextSend(int $now, \DateTimeZone $zone): int
    {
        $local = (new \DateTimeImmutable('@' . $now))->setTimezone($zone);
        $monday = $local->modify('monday this week')->setTime(self::SEND_HOUR, 0);

        if ($monday->getTimestamp() <= $now) {
            $monday = $monday->modify('+1 week');
        }

        return $monday->getTimestamp();
    }

    /**
     * The scheduled send: a skip reason, or {@see SENT} / {@see FAILED}.
     */
    public function run(): string
    {
        if (!$this->settings->enabled()) {
            return self::OFF;
        }

        $report = $this->report();
        $reason = WeeklySummary::skipReason($report, $this->milestones->firstPublish());

        if ($reason !== null) {
            return $reason;
        }

        return $this->send($report, $this->settings->recipients(), false) ? self::SENT : self::FAILED;
    }

    /**
     * Send this week's summary now, to the given addresses, whatever the data.
     *
     * @param list<string> $to
     */
    public function sendTest(array $to): bool
    {
        return $this->send($this->report(), $to, true);
    }

    /**
     * @param array<string, mixed> $report
     * @param list<string> $to
     */
    private function send(array $report, array $to, bool $test): bool
    {
        if ($to === []) {
            return false;
        }

        $model = WeeklySummary::compose(
            $report,
            $this->milestones->firstPublish(),
            wp_specialchars_decode((string) get_bloginfo('name'), ENT_QUOTES),
            admin_url(\WConvert\Admin\AdminMenu::href()),
            $test
        );

        return $this->mailer->send($to, $model['subject'], SummaryTemplate::html($model), SummaryTemplate::text($model));
    }

    /**
     * The last seven complete site days, with the seven before and Insights:
     * the same read the Analytics screen makes for "Last 7 days".
     *
     * @return array<string, mixed>
     */
    private function report(): array
    {
        return $this->dashboard->compare(StatRange::completeDays(7, StatDay::today()));
    }
}
