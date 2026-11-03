<?php

namespace WConvert\Rest;

use WConvert\Milestone\MilestoneStore;
use WConvert\Report\WeeklySummaryJob;
use WConvert\Report\WeeklySummarySettings;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * Settings → Email reports: read and save the weekly summary's switch and
 * recipients, and send a test (ADR 0176).
 */
final class ReportController implements RestController
{
    public function __construct(
        private readonly WeeklySummarySettings $settings,
        private readonly WeeklySummaryJob $job,
        private readonly MilestoneStore $milestones,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/reports/weekly', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'show'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'update'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'enabled' => ['type' => 'boolean', 'required' => true],
                    'recipients' => ['type' => 'string', 'required' => true],
                ],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/reports/weekly/test', [
            'methods' => 'POST',
            'callback' => [$this, 'test'],
            'permission_callback' => [Routes::class, 'canManage'],
            'args' => [
                'recipients' => ['type' => 'string', 'required' => true],
            ],
        ]);
    }

    public function show(): WP_REST_Response
    {
        $next = wp_next_scheduled(WeeklySummaryJob::HOOK);

        return new WP_REST_Response([
            'enabled' => $this->settings->enabled(),
            'recipients' => implode(', ', $this->settings->chosen() ?: [$this->settings->defaultRecipient()]),
            'default_recipient' => $this->settings->defaultRecipient(),
            'waiting_for_publish' => $this->milestones->firstPublish() === null,
            'next_send' => $next === false ? null : wp_date('Y-m-d H:i:s', $next),
        ]);
    }

    public function update(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $enabled = (bool) $request->get_param('enabled');
        $parsed = $this->recipients((string) $request->get_param('recipients'), $enabled);

        if ($parsed instanceof WP_Error) {
            return $parsed;
        }

        $this->settings->save($enabled, $parsed);

        return $this->show();
    }

    public function test(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $parsed = $this->recipients((string) $request->get_param('recipients'), true);

        if ($parsed instanceof WP_Error) {
            return $parsed;
        }

        if (!$this->job->sendTest($parsed)) {
            return new WP_Error(
                'wconvert_summary_not_sent',
                __('WordPress could not send the email. Check your site’s email setup.', 'wconvert'),
                ['status' => 502]
            );
        }

        return new WP_REST_Response(['sent' => true, 'to' => $parsed]);
    }

    /**
     * @return list<string>|WP_Error
     */
    private function recipients(string $raw, bool $required): array|WP_Error
    {
        $parsed = WeeklySummarySettings::parse($raw, static fn (string $address): bool => is_email($address) !== false);

        if ($parsed['invalid'] !== []) {
            return new WP_Error(
                'wconvert_invalid_recipients',
                /* translators: %s: the addresses that are not valid, comma separated. */
                sprintf(__('Check these addresses: %s', 'wconvert'), implode(', ', $parsed['invalid'])),
                ['status' => 400]
            );
        }

        if ($required && $parsed['valid'] === []) {
            return new WP_Error('wconvert_invalid_recipients', __('Enter at least one email address.', 'wconvert'), ['status' => 400]);
        }

        if (count($parsed['valid']) > WeeklySummarySettings::MAX_RECIPIENTS) {
            return new WP_Error(
                'wconvert_invalid_recipients',
                /* translators: %d: the most addresses allowed. */
                sprintf(__('Use %d addresses or fewer.', 'wconvert'), WeeklySummarySettings::MAX_RECIPIENTS),
                ['status' => 400]
            );
        }

        return $parsed['valid'];
    }
}
