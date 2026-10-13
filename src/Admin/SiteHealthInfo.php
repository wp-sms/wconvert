<?php

namespace WConvert\Admin;

use WConvert\Optin\OptinRepository;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;
use WConvert\Support\TierManifest;

defined('ABSPATH') || exit;

/**
 * Tools → Site Health → Info → WConvert: what support asks for first, copied
 * with the rest of the report by WordPress's own "Copy site info to
 * clipboard".
 *
 * The Help page points here rather than drawing a site-details box of its own:
 * Site Health already holds WordPress, PHP, the theme and every active plugin,
 * and a second copy button would be a second, smaller report. Pro adds its
 * licence beside this as its own section ({@see \WConvert\Pro\License\SiteHealth}).
 *
 * Computed when the page is read; nothing is stored and nothing is sent.
 *
 * @since 1.0.0
 */
final class SiteHealthInfo
{
    public const SECTION = 'wconvert';

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly ProPresence $pro,
        private readonly TierManifest $manifest,
    ) {
    }

    /**
     * @param mixed $info
     * @return array<string, mixed>
     */
    public function addSection($info): array
    {
        $info = is_array($info) ? $info : [];

        // Site Health opens for whoever may install plugins; WConvert's own
        // screens are for whoever may manage options, and so is this.
        if (!current_user_can('manage_options')) {
            return $info;
        }

        $info[self::SECTION] = [
            'label' => __('WConvert', 'wconvert'),
            'fields' => $this->fields(),
        ];

        return $info;
    }

    /** @return array<string, array{label: string, value: string, debug: string}> */
    public function fields(): array
    {
        $tier = $this->pro->installedTier();
        $published = 0;
        $drafts = 0;

        // Top-level campaigns only: an A/B variant is part of its campaign.
        foreach ($this->optins->summaries() as $row) {
            if ($row['deleted_at'] !== null) {
                continue;
            }

            $row['published_at'] !== null ? $published++ : $drafts++;
        }

        return [
            'version' => ['label' => __('Version', 'wconvert'), 'value' => WCONVERT_VERSION, 'debug' => WCONVERT_VERSION],
            // `tiers.json` names the paid rungs only; free is the admin's own word for it.
            'plan' => ['label' => __('Plan', 'wconvert'), 'value' => $tier === Tier::Free ? __('Free', 'wconvert') : $this->manifest->displayName($tier), 'debug' => $tier->value],
            'campaigns' => [
                'label' => __('Campaigns', 'wconvert'),
                /* translators: 1: number of published campaigns, 2: number of draft campaigns */
                'value' => sprintf(__('%1$d published, %2$d drafts', 'wconvert'), $published, $drafts),
                'debug' => $published . ' published, ' . $drafts . ' drafts',
            ],
        ];
    }
}
