<?php

namespace WConvert\Frontend;

use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedProjection;
use WConvert\Rest\Routes;
use WConvert\Rules\DisplayPlan;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * `?wconvert-preview=<id>`: **an administrator sees a campaign's working draft
 * on the real site, now** (ADR 0151).
 *
 * ============================================================================
 * THE INSPECTOR EXPLAINS; THIS SHOWS.
 * ============================================================================
 * {@see InspectorEnqueue} answers *"why did this page show what it showed"*
 * against the published set, so it must not change what shows. This answers
 * *"what will it look like"*, for a draft that is not in the set at all, so it
 * replaces the set for one request with a set of one: the draft, rewritten so
 * that nothing stands between it and the screen. No schedule, no allowance,
 * every page, everyone, right away.
 *
 * The rewrite is the whole feature, and it is {@see self::shownNow()}: pure
 * and static, so the suite can hold it without a WordPress. The rewritten row
 * then goes through {@see PublishedProjection::build()} like every published
 * row does, so the browser gets the same shape a live campaign gets and the
 * loader needs no preview mode (its byte budget is untouched).
 *
 * ============================================================================
 * IT RECORDS NOTHING.
 * ============================================================================
 * {@see LoaderEnqueue} prints the preview with no beacon URL, no capture URL
 * and no site allowance. A submit shows the form's own "not confirmed" state,
 * so previewing a live campaign's unpublished edits never creates a real
 * [[Lead]] or a counted [[Impression]]. The routes would refuse a draft id
 * anyway (it is not in the published set); blanking them also covers a live
 * one.
 *
 * Same gate as the inspector: `Routes::MANAGE_CAPABILITY`, checked in PHP on
 * an uncached request. Anyone else, or an id that names nothing, gets the
 * ordinary page and no error.
 *
 * @since 0.1.0
 */
final class DraftPreview
{
    /** The query parameter that asks for it. Its value is the Optin's id. */
    public const PARAM = 'wconvert-preview';

    /** @var list<array<string, mixed>>|null */
    private ?array $set = null;

    private bool $resolved = false;

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly RuleVocabulary $vocabulary,
    ) {
    }

    /** The address that previews one campaign; `siteLinks.ts` builds the same one for the admin. */
    public static function url(string $id): string
    {
        return add_query_arg(self::PARAM, $id, home_url('/'));
    }

    public function hooks(): void
    {
        // Headers are still unsent here and no longer are by
        // `wp_enqueue_scripts`, which runs inside `wp_head`.
        add_action('template_redirect', [$this, 'neverCache']);
    }

    /**
     * A preview is one administrator's page. A cache that kept it would serve
     * a draft to the next visitor.
     */
    public function neverCache(): void
    {
        if (self::asked() === null) {
            return;
        }

        nocache_headers();

        if (!defined('DONOTCACHEPAGE')) {
            // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- the page caches' shared convention; it has to be this name to be read.
            define('DONOTCACHEPAGE', true);
        }
    }

    /**
     * The one-entry set to print instead of the published one, or null when
     * this request is not a preview.
     *
     * Read once per request: the loader asks, and so might anything after it.
     *
     * @return list<array<string, mixed>>|null
     */
    public function set(): ?array
    {
        if ($this->resolved) {
            return $this->set;
        }

        $this->resolved = true;
        $id = self::asked();
        $optin = $id === null ? null : $this->optins->find($id);

        if ($optin === null || $optin->isDeleted()) {
            return null;
        }

        $set = PublishedProjection::build([self::row($optin, gmdate('Y-m-d H:i:s'))], $this->vocabulary, wp_timezone());

        if ($set === []) {
            return null;
        }

        $this->set = array_map([self::class, 'withoutRequirements'], $set);

        return $this->set;
    }

    /**
     * The draft as a published row would carry it, rewritten to show now.
     *
     * Alone, with no `parent_id`: a [[Variant]] previewed is that arm, not a
     * draw between arms.
     *
     * @return array<string, mixed>
     */
    public static function row(Optin $optin, string $now): array
    {
        return [
            'id' => $optin->id,
            'parent_id' => null,
            'goal' => $optin->goal,
            'published_config' => (string) wp_json_encode(self::shownNow($optin->config)),
            'published_at' => $now,
            'deleted_at' => null,
        ];
    }

    /**
     * A config with everything that decides WHETHER it shows taken out, and
     * everything that decides WHAT shows left in.
     *
     * - no `starts_at` / `ends_at`, so a finished sale or a teaser for next
     *   month shows today;
     * - a frequency that a dismissal, a submission or a cooldown cannot stop,
     *   so the preview shows again after the merchant closed it;
     * - no Targeting, which reads as every page;
     * - Everyone, opening immediately — so no Condition, Trigger or consent
     *   gate stands in the way, and nothing premium is left to degrade;
     * - no content lock, because a preview on the home page has no region to
     *   lock.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function shownNow(array $config): array
    {
        unset($config['starts_at'], $config['ends_at'], $config['content_lock']);

        $config['frequency'] = ['stopAfterDismiss' => false, 'stopAfterConversion' => false];
        $config['targeting'] = [];
        $config['display_rules'] = DisplayPlan::immediate();

        return $config;
    }

    /**
     * Without the rules the projection adds from the [[Goal]]: a cart-recovery
     * campaign requires a cart with items, and the preview shows on any page.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    private static function withoutRequirements(array $entry): array
    {
        unset($entry['payload']['required_rules']);

        return $entry;
    }

    /**
     * The id asked for, on a page an administrator is looking at, or null.
     *
     * The value is only ever used as an id, and {@see Ulid::isOne()} is the
     * closed check every route uses — anything else is not a preview. No
     * nonce, for the inspector's reason: it is a link a merchant opens,
     * bookmarks and shares with a colleague who can also manage the site,
     * and it changes nothing.
     */
    private static function asked(): ?string
    {
        if (is_admin() || is_feed() || is_robots() || is_embed()) {
            return null;
        }

        if (!current_user_can(Routes::MANAGE_CAPABILITY)) {
            return null;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only, gated on manage_options, and the value must pass Ulid::isOne() below.
        $id = isset($_GET[self::PARAM]) && is_string($_GET[self::PARAM]) ? sanitize_text_field(wp_unslash($_GET[self::PARAM])) : '';

        return Ulid::isOne($id) ? $id : null;
    }
}
