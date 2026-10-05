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
            '<p>' . __('If a form asks for your consent, we save the exact consent statement shown when you submitted it. Each completed signup is saved immediately. An optional email or SMS signup has its own consent statement and acceptance time; skipping it does not undo an earlier signup.', 'wconvert') . '</p>',
            '<p>' . __('We do not add the page address, IP address or browser details to the saved form submission.', 'wconvert') . '</p>',
            '<h3>' . __('Browser storage and campaign statistics', 'wconvert') . '</h3>',
            '<p>' . sprintf(
                $browser['stores_ab_assignment']
                    /* translators: %s: the browser storage key used by WConvert. */
                    ? __('Your browser remembers whether a campaign was shown, dismissed or completed, and which version was assigned during an A/B test. This avoids repeatedly showing the same campaign and keeps the assigned version consistent. The record is stored in local storage under the name %s. It remains until you clear the site data or the browser removes it.', 'wconvert')
                    /* translators: %s: the browser storage key used by WConvert. */
                    : __('Your browser remembers whether a campaign was shown, dismissed or completed. This avoids repeatedly showing the same campaign. The record is stored in local storage under the name %s. It remains until you clear the site data or the browser removes it.', 'wconvert'),
                '<code>' . esc_html($browser['key']) . '</code>'
            ) . '</p>',
            '<p>' . sprintf(
                /* translators: %s: how long the fallback browser cookie lasts, already pluralized. */
                __('If local storage is unavailable, WConvert uses a cookie with the same name for up to %s. This browser record contains no name, email address, phone number or visitor identifier created by WConvert.', 'wconvert'),
                $this->cookieDuration($browser['cookie_fallback_days'])
            ) . '</p>',
            '<p>' . __('When a Campaign uses a session limit, WConvert stores appearance counts under wcv_display_session_v1 in this tab’s session storage. It holds at most 128 Campaign families, evicting the least recently shown. It contains no contact details or visitor identifier. Browsers may copy or restore tab sessions; if storage is blocked, the limit lasts only on the current page.', 'wconvert') . '</p>',
            ...array_map(static fn (string $note): string => '<p>' . esc_html($note) . '</p>', $browser['additional'] ?? []),
            ...($browser['cart_recovery'] !== null ? [
                '<p>' . __('Cart recovery stores the cart item count and total in a browser cookie until the WooCommerce cart session ends. The cookie does not store product or contact details. Cart targeting also checks the current WooCommerce session. Only campaign matches and public product suggestions stay in page memory for up to 30 seconds; WConvert does not save cart contents or create a visitor identifier. These requests use a separate 60-second rate-limit bucket containing a site-specific one-way IP hash.', 'wconvert') . '</p>',
                '<p>' . __('Adding a recommended product uses the existing WooCommerce session. To prevent duplicate additions, WConvert keeps temporary server records of the selected product and action status under site-specific hashed keys. These records expire after 30 minutes and are removed by scheduled cleanup. They are also removed when WConvert Pro is uninstalled.', 'wconvert') . '</p>',
            ] : []),
            ...($browser['content_unlock'] !== null ? [
                '<p>' . __('Content locks remember a successful submission for the same Campaign in this browser for 30 days. This site-scoped local storage holds at most 64 Campaign IDs and expiry days, with no contact details or visitor identifier. If storage is blocked, access is remembered only on the current page.', 'wconvert') . '</p>',
            ] : []),
            ...($browser['reopen_session'] !== null ? [
                '<p>' . __('When a reopen button is enabled, WConvert uses session storage to remember the Campaign and your reminder dismissals in this browser tab. It contains no contact details or visitor identifier. It lasts for the browser page session; browsers may copy it to duplicated tabs or restore it when restoring a session. If storage is unavailable, recovery lasts only on the current page.', 'wconvert') . '</p>',
            ] : []),
            '<p>' . sprintf(__('When product recommendations are active, WConvert also records daily counts of product cards shown, product links clicked and confirmed basket additions. These counts contain product and campaign IDs, with no visitor identifier or contact details. Product activity is kept for %d days and removed by scheduled cleanup; campaign totals are kept separately.', 'wconvert'), $summary['product_activity_retention_days']) . '</p>',
            '<p>' . __('WConvert records total campaign views, dismissals and completions by campaign and day. These totals are not linked to individual visitors.', 'wconvert') . '</p>',
            '<p>' . sprintf(
                /* translators: %s: the short lifetime of the campaign-counting rate-limit record. */
                __('To limit repeated counting requests, WConvert temporarily keeps a site-specific one-way hash of the visitor’s IP address for %s. The IP address itself is not saved.', 'wconvert'),
                $this->shortDuration($summary['beacon_rate_limit_seconds'])
            ) . '</p>',
            '<p>' . sprintf(
                /* translators: %s: the capture rate-limit record lifetime. */
                __('To slow repeated form submissions, WConvert temporarily keeps a separate site-specific one-way hash of the IP address for each campaign for %s. The IP address itself is not saved.', 'wconvert'),
                $this->shortDuration($summary['capture_rate_limit_seconds'])
            ) . '</p>',
            '<p>' . __('To limit repeated resource emails, WConvert keeps a site-specific one-way code derived from the recipient email and resource for a ten-minute sending window. Expired codes are cleaned up on the site’s scheduled maintenance runs. Protection activity is stored as approximate totals without form values for up to 24 hours.', 'wconvert') . '</p>',
            ...($summary['protection_provider'] !== 'none' ? [
                '<p>' . sprintf(/* translators: %s: configured bot verification provider. */ __('This site uses %s to verify form submissions. The provider receives browser and network information during verification. WConvert sends the verification token to that service, without the contact fields entered in the form.', 'wconvert'), esc_html($summary['protection_provider'])) . '</p>',
            ] : []),
            '<p>' . __('Form protection checks may refuse a submission. WConvert does not build visitor profiles from form submissions.', 'wconvert') . '</p>',
            '<h3>' . __('Who receives your information', 'wconvert') . '</h3>',
            $this->destinationDisclosure($summary['destinations']),
            '<p>' . __('Site administrators can also export form submissions to a CSV file. Connected services, exported files, email logs and backups keep separate copies and may follow different retention periods.', 'wconvert') . '</p>',
            '<h3>' . __('How long we keep your information', 'wconvert') . '</h3>',
            '<p>' . $this->retentionSentence($summary['retention_days']) . '</p>',
            '<h3>' . __('Your choices and rights', 'wconvert') . '</h3>',
            '<p>' . __('You may ask us for a copy of the personal information we hold from WConvert form submissions or ask us to delete it, subject to applicable legal requirements. We may need to verify your email address or phone number before completing the request.', 'wconvert') . '</p>',
            '<p>' . __('Deleting a submission from WConvert does not automatically remove copies already sent to a connected service, included in an exported file or email log, or retained in a backup. Those copies are managed separately.', 'wconvert') . '</p>',
        ];

        $analytics = apply_filters('wconvert_analytics_privacy', null);
        if (is_array($analytics) && !empty($analytics['configured'])) {
            $provider = ($analytics['route'] ?? '') === 'plausible' ? 'Plausible' : 'Google Analytics';
            $sections[] = '<h3>' . __('External campaign analytics', 'wconvert') . '</h3><p>' . sprintf(
                /* translators: %s: configured analytics provider name. */
                __('We use our existing %s installation to measure campaign appearances and accepted outcomes. WConvert supplies campaign identifiers, public labels and outcome types, not your submitted contact details or answers. The existing analytics tag may attach its own identifiers and page information. Collection follows this site’s configured consent controls.', 'wconvert'),
                $provider
            ) . '</p>';
        }
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

        if ($seconds % 60 === 0) {
            $minutes = (int) ($seconds / 60);

            return sprintf(
                /* translators: %s: a number of minutes. */
                _n('%s minute', '%s minutes', $minutes, 'wconvert'),
                number_format_i18n($minutes)
            );
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
