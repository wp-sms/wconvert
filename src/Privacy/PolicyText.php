<?php

namespace WConvert\Privacy;

defined('ABSPATH') || exit;

/**
 * The privacy-policy text WConvert suggests to the merchant.
 *
 * WordPress collects these into the policy-editor's guide, where a merchant
 * copies what applies to their site. WSMS's `PrivacyServiceProvider` is the
 * pattern (ADR 0018).
 *
 * Two of the sentences are decisions rather than boilerplate:
 *
 * **The retention period is stated.** A merchant who configures one gets the
 * disclosure written for them, rather than discovering later that they needed
 * to write it. With none configured — which is how WConvert ships — it says
 * Leads are kept until deleted, because that is what happens.
 *
 * **Exported files are the merchant's to control.** A CSV already downloaded
 * is out of WConvert's reach permanently. Tracking exports so that it would
 * not be means logging who exported what, which is more personal data to solve
 * a personal-data problem — so the honest move is to say where the
 * responsibility went (ADR 0018).
 *
 * The dynamic facts come from {@see DataMap}, the same source the WConvert
 * admin reads. WordPress deliberately treats this as suggested text: changing
 * a Destination can flag the guide for review, but WConvert never edits the
 * site's published policy.
 *
 * @since 0.1.0
 */
final class PolicyText
{
    public function __construct(
        private readonly DataMap $map,
    ) {
    }

    public function register(): void
    {
        wp_add_privacy_policy_content('WConvert', $this->content());
    }

    /**
     * The suggestion, as the paragraphs WordPress renders into the guide.
     */
    public function content(): string
    {
        $summary = $this->map->summary();
        $browser = $summary['browser'];

        $sections = [
            '<p class="privacy-policy-tutorial">' . __('Before publishing, explain why each WConvert form collects information and which legal basis you rely on. Add a privacy contact, links to the privacy notices of configured services, and any international-transfer safeguards that apply to your site.', 'wconvert') . '</p>',
            '<strong class="privacy-policy-tutorial">' . __('Suggested text:', 'wconvert') . '</strong>',
            '<h2>' . __('WConvert forms and campaigns', 'wconvert') . '</h2>',
            '<p>' . __('We use WConvert to display campaigns, including forms and messages, on this website. When a campaign includes a form, we use the information you submit for the purpose described in that form, such as responding to a request, providing a resource or managing a subscription.', 'wconvert') . '</p>',
            '<h3>' . __('Information we collect', 'wconvert') . '</h3>',
            '<p>' . __('When you submit a WConvert form, we collect the information shown in that form. Depending on the form, this may include your name, email address, phone number, selections and messages. We also record which campaign received the submission and the date and time it was submitted.', 'wconvert') . '</p>',
            '<p>' . __('If a form asks for your consent, we save the exact consent statement shown when you submitted it. This lets us keep a record of what you agreed to.', 'wconvert') . '</p>',
            '<p>' . __('We do not add the page address, IP address or browser details to the saved form submission.', 'wconvert') . '</p>',
            '<h3>' . __('Browser storage and campaign statistics', 'wconvert') . '</h3>',
            '<p>' . sprintf(
                /* translators: %s: the browser storage key used by WConvert. */
                __('Your browser remembers whether a campaign was shown, dismissed or completed, and which version was assigned during an A/B test. This helps avoid repeatedly showing the same campaign and keeps the assigned version consistent. The record is stored in local storage under the name %s. Local storage has no set expiry and remains until you clear the site data or the browser removes it.', 'wconvert'),
                '<code>' . esc_html($browser['key']) . '</code>'
            ) . '</p>',
            '<p>' . sprintf(
                /* translators: %s: how long the fallback browser cookie lasts, already pluralized. */
                __('If local storage is unavailable, WConvert uses a cookie with the same name for up to %s. This browser record contains no name, email address, phone number or visitor identifier created by WConvert.', 'wconvert'),
                $this->cookieDuration($browser['cookie_fallback_days'])
            ) . '</p>',
            '<p>' . __('WConvert records total campaign views, dismissals and completions by campaign and day. These totals are not linked to individual visitors.', 'wconvert') . '</p>',
            '<p>' . sprintf(
                /* translators: %s: the short lifetime of the campaign-counting rate-limit record. */
                __('To limit repeated counting requests, WConvert temporarily keeps a site-specific one-way hash of the visitor’s IP address for %s. The IP address itself is not saved.', 'wconvert'),
                $this->shortDuration($summary['beacon_rate_limit_seconds'])
            ) . '</p>',
            '<p>' . __('WConvert does not use form submissions for automated decision-making or to build visitor profiles.', 'wconvert') . '</p>',
            '<h3>' . __('Who receives your information', 'wconvert') . '</h3>',
            $this->destinationDisclosure($summary['destinations']),
            '<p>' . __('Site administrators can also export form submissions to a CSV file. Connected services, exported files, email logs and backups keep separate copies and may follow different retention periods.', 'wconvert') . '</p>',
            '<h3>' . __('How long we keep your information', 'wconvert') . '</h3>',
            '<p>' . $this->retentionSentence($summary['retention_days']) . '</p>',
            '<h3>' . __('Your choices and rights', 'wconvert') . '</h3>',
            '<p>' . __('You may ask us for a copy of the personal information we hold from WConvert form submissions or ask us to delete it, subject to applicable legal requirements. We may need to verify your email address or phone number before completing the request.', 'wconvert') . '</p>',
            '<p>' . __('Deleting a submission from WConvert does not automatically remove copies already sent to a connected service, included in an exported file or email log, or retained in a backup. Those copies are managed separately.', 'wconvert') . '</p>',
        ];

        return implode("\n", $sections);
    }

    /**
     * The one sentence the configured period changes.
     */
    private function retentionSentence(?int $days): string
    {
        if ($days === null) {
            return __('We keep form submissions until a site administrator deletes them.', 'wconvert');
        }

        return sprintf(
            /* translators: %s: the configured retention period, already pluralised — "1 day", "90 days". */
            __('We keep form submissions for %s after they are submitted, then delete them automatically.', 'wconvert'),
            $this->days($days)
        );
    }

    /**
     * The services a configured Destination may copy a submission to.
     * Internal route labels are intentionally omitted from visitor-facing text.
     *
     * @param list<array{id: string, label: string, type: string, type_label: string, fields: list<string>|null}> $destinations
     */
    private function destinationDisclosure(array $destinations): string
    {
        if ($destinations === []) {
            return '<p>' . __('We do not currently use WConvert to send form submissions to another configured destination.', 'wconvert') . '</p>';
        }

        /** @var array<string, array{label: string, fields: list<string>}> $services */
        $services = [];

        foreach ($destinations as $destination) {
            $service = $services[$destination['type']] ?? [
                'label' => $destination['type_label'],
                'fields' => [],
            ];

            foreach ($destination['fields'] ?? [] as $field) {
                if (!in_array($field, $service['fields'], true)) {
                    $service['fields'][] = $field;
                }
            }

            $services[$destination['type']] = $service;
        }

        $items = [];
        foreach ($services as $service) {
            $label = '<strong>' . esc_html($service['label']) . '</strong>';
            $fields = array_map($this->fieldLabel(...), $service['fields']);
            $items[] = '<li>' . ($fields === []
                ? $label
                : sprintf(
                    /* translators: 1: destination service name, 2: comma-separated information it may receive. */
                    __('%1$s: %2$s', 'wconvert'),
                    $label,
                    esc_html(implode(', ', $fields))
                )) . '</li>';
        }

        return '<p>' . __('Depending on the form you submit, we may send a copy of your information to these configured services:', 'wconvert') . '</p>'
            . "\n<ul>\n" . implode("\n", $items) . "\n</ul>";
    }

    private function fieldLabel(string $field): string
    {
        return match ($field) {
            'email' => __('email address', 'wconvert'),
            'phone' => __('phone number', 'wconvert'),
            'name' => __('name', 'wconvert'),
            'interest' => __('interest answer', 'wconvert'),
            default => $field,
        };
    }

    private function days(int $days): string
    {
        return sprintf(
            /* translators: %s: a number of days. */
            _n('%s day', '%s days', $days, 'wconvert'),
            number_format_i18n($days)
        );
    }

    private function shortDuration(int $seconds): string
    {
        if ($seconds === 60) {
            return __('one minute', 'wconvert');
        }

        return sprintf(
            /* translators: %s: a number of seconds. */
            _n('%s second', '%s seconds', $seconds, 'wconvert'),
            number_format_i18n($seconds)
        );
    }

    private function cookieDuration(int $days): string
    {
        return $days === 365
            ? __('one year', 'wconvert')
            : $this->days($days);
    }
}
