<?php

namespace WConvert\Privacy;

use WConvert\Retention\RetentionPeriod;

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
 * @since 0.1.0
 */
final class PolicyText
{
    public function __construct(
        private readonly RetentionPeriod $retention,
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
        $paragraphs = [
            __(
                'When you submit a form displayed by WConvert, we store what you entered — which may include your'
                . ' email address and phone number — along with the page and the form it came from, and the date.',
                'wconvert'
            ),
            __(
                'Where a form asked you to agree to something, we also store the wording of that agreement exactly'
                . ' as it was shown to you at the time, so that what you consented to can be established later.',
                'wconvert'
            ),
            $this->retentionSentence(),
            __(
                'Site administrators can export these submissions to a spreadsheet file. Once a file has been'
                . ' exported it is held by the site owner, and this plugin can no longer reach it.',
                'wconvert'
            ),
        ];

        return '<p>' . implode('</p>' . "\n" . '<p>', $paragraphs) . '</p>';
    }

    /**
     * The one sentence the configured period changes.
     */
    private function retentionSentence(): string
    {
        $days = $this->retention->days();

        if ($days === null) {
            return __('We keep these submissions until you delete them.', 'wconvert');
        }

        return sprintf(
            /* translators: %s: the configured retention period, already pluralised — "1 day", "90 days". */
            __('We keep these submissions for %s, after which they are deleted automatically.', 'wconvert'),
            sprintf(
                /* translators: %s: a number of days. */
                _n('%s day', '%s days', $days, 'wconvert'),
                number_format_i18n($days)
            )
        );
    }
}
