<?php

namespace WConvert\Agent;

use WConvert\Discovery\OccasionStore;
use WConvert\Discovery\SetupIndex;
use WConvert\Goal\Goal;
use WConvert\Optin\OccasionSchedule;
use WConvert\Optin\Schedule;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Template\OptinConfigBuilder;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Template\ThemeTokens;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * What an agent says about a campaign, checked and turned into a draft's
 * config.
 *
 * ============================================================================
 * EVERY REFUSAL SAYS HOW TO FIX IT.
 * ============================================================================
 * An agent cannot see the editor, so a refusal that only says "invalid" sends
 * it guessing. Each one here names the field and what would be accepted: the
 * roles a design takes, the design that would run, the date format. What this
 * does not check, `POST /optins` and `PATCH /optins/{id}` still do, and their
 * refusals reach the agent unchanged.
 */
final class AgentCampaignInput
{
    public function __construct(
        private readonly TemplateLibrary $library,
        private readonly TemplateVocabulary $vocabulary,
        private readonly OptinConfigBuilder $builder,
        private readonly OccasionStore $occasions,
        private readonly PlaybookLibrary $playbooks,
        private readonly Prefill $prefill,
        private readonly SetupIndex $index,
    ) {
    }

    /**
     * The fields `create-campaign` and `update-campaign` share, as JSON Schema.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function schema(): array
    {
        $paths = ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => 20];
        return [
            'copy' => ['type' => 'object', 'additionalProperties' => true, 'description' => 'Words by slot role, plain text only, e.g. {"headline": "30% off everything", "cta_label": "Shop the sale"}. A role used several times takes a list. find-designs lists each design\'s roles.'],
            'link' => ['type' => 'string', 'description' => 'Where the design\'s link button goes: a full address or a path on this site, e.g. "/black-friday/".'],
            'pages' => ['type' => 'object', 'additionalProperties' => false, 'description' => 'Which pages it shows on. Paths, where * matches anything: "/black-friday/*"; and/or every single post of a type: "post" for blog posts, "page", "product". Leave both show_on fields out for every page.', 'properties' => [
                'show_on' => $paths + ['description' => 'Only these paths.'],
                'show_on_types' => ['type' => 'array', 'items' => ['type' => 'string', 'pattern' => '^[a-z0-9_-]{1,20}$'], 'maxItems' => 10, 'description' => 'Only on single posts of these types: "post" (blog posts), "page", "product".'],
                'hide_on' => $paths + ['description' => 'Never these paths.'],
            ]],
            'inline_position' => ['type' => 'string', 'enum' => ['before_content', 'after_content', 'after_paragraph', 'after_product_summary'], 'description' => 'For an inline campaign: where it goes in each page it shows on. Left out, it shows only where someone places the WConvert block or the [wconvert_optin] shortcode.'],
            'after_paragraph' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'description' => 'With inline_position "after_paragraph": which paragraph it follows.'],
            'frequency' => ['type' => 'object', 'additionalProperties' => false, 'description' => 'How often one visitor sees it.', 'properties' => [
                'per_session' => ['type' => 'integer', 'minimum' => 1, 'description' => 'At most this many times per visit.'],
                'cooldown_days' => ['type' => 'integer', 'minimum' => 1, 'description' => 'Then not again for this many days.'],
                'max_times' => ['type' => 'integer', 'minimum' => 1, 'description' => 'At most this many times ever.'],
                'stop_after_close' => ['type' => 'boolean', 'description' => 'Stop once the visitor closes it.'],
            ]],
            'starts_at' => ['type' => 'string', 'description' => 'When it starts showing, "YYYY-MM-DD HH:MM" in the site timezone. "" for no start.'],
            'ends_at' => ['type' => 'string', 'description' => 'When it stops showing (that minute is no longer shown), "YYYY-MM-DD HH:MM" in the site timezone. "" for no end. A countdown counts to this.'],
            'occasion_id' => ['type' => 'string', 'description' => 'The occasion it belongs to, from list-occasions. With no dates given, the dates are the occasion\'s. "" for none.'],
            'use_site_colors' => ['type' => 'boolean', 'description' => 'Paint the design in this site\'s theme colours and font.'],
        ];
    }

    /**
     * A new draft's name, Goal and config, or why not.
     *
     * @param array<string, mixed> $input
     * @return array{name: string, goal: string, config: array<string, mixed>}|WP_Error
     */
    public function forCreate(array $input): array|WP_Error
    {
        $goal = Goal::tryFrom((string) ($input['goal'] ?? ''));
        if ($goal === null) return Reply::refused(__('Give a goal: grow_email_list, grow_sms_list, increase_basket_value, recover_cart, promote_offer, deliver_lead_magnet, collect_enquiries or find_match.', 'wconvert'));
        if (isset($input['design_id']) === isset($input['starter_id'])) {
            return Reply::refused(__('Give either a design_id (from wconvert/find-designs) or a starter_id (from wconvert/list-starters), not both.', 'wconvert'));
        }

        $base = null;
        if (isset($input['starter_id'])) {
            $base = $this->starter((string) $input['starter_id'], $goal);
            if ($base instanceof WP_Error) return $base;
            $type = (string) $base['display_type'];
        } else {
            $design = $this->design((string) $input['design_id']);
            if ($design instanceof WP_Error) return $design;
            $type = (string) $design['display_type'];
        }
        if (isset($input['display_type']) && $input['display_type'] !== $type) {
            /* translators: 1: a display type the agent asked for. 2: the display type of the design it named. */
            return Reply::refused(sprintf(__('That design is a %2$s, not a %1$s. Leave display_type out, or pick a %1$s design with wconvert/find-designs.', 'wconvert'), (string) $input['display_type'], $type));
        }

        $campaign = ['display_type' => $type];
        if (isset($input['design_id'])) $campaign['design'] = (string) $input['design_id'];
        $mapped = $this->mapped($input, null);
        if ($mapped instanceof WP_Error) return $mapped;
        [$campaign, $occasion] = [$campaign + $mapped['campaign'], $mapped['occasion']];

        $tree = $base['template']['tree'] ?? ($this->library->find((string) ($input['design_id'] ?? ''))['tree'] ?? []);
        $copy = $this->copy($input['copy'] ?? null, $tree);
        if ($copy instanceof WP_Error) return $copy;
        $campaign['copy'] = $copy;

        $config = $this->builder->build($campaign, $occasion, $base);
        if (is_string($config)) return Reply::refused($config);
        $config = $this->colored($config, $input);
        // A design's own address is a placeholder ("/sale/"), so an offer is never sent there unasked.
        if ($goal === Goal::PromoteOffer && !isset($campaign['link']) && DesignFacts::of($config['template']['tree'] ?? null)['has_link_button']) {
            return Reply::refused(__('A promote_offer campaign sends visitors to the offer. Give link: a full address or a path like "/black-friday/".', 'wconvert'), 'wconvert_agent_needs_link');
        }
        $refusal = self::needs($config);
        if ($refusal !== null) return $refusal;
        return ['name' => (string) $input['name'], 'goal' => $goal->value, 'config' => $config];
    }

    /**
     * A stored draft's config with only the given fields changed, or why not.
     *
     * @param array<string, mixed> $input
     * @param array<string, mixed> $config The draft as `GET /optins/{id}` returned it.
     * @return array<string, mixed>|WP_Error
     */
    public function forUpdate(array $input, array $config): array|WP_Error
    {
        $mapped = $this->mapped($input, $config);
        if ($mapped instanceof WP_Error) return $mapped;
        foreach ($mapped['campaign'] as $key => $value) {
            if ($key === 'link') continue;
            if ($key === 'frequency') $config['frequency'] = array_replace(is_array($config['frequency'] ?? null) ? $config['frequency'] : [], $value);
            elseif ($key === 'targeting') $config['targeting'] = $value + array_intersect_key(is_array($config['targeting'] ?? null) ? $config['targeting'] : [], array_flip(['logged_in', 'roles']));
            elseif ($value === '') unset($config[$key]);
            else $config[$key] = $value;
        }
        if (array_key_exists('occasion_id', $input)) {
            if ($mapped['occasion'] === null) unset($config['occasion']);
            else $config['occasion'] = $mapped['occasion'];
        }
        if (isset($input['copy'])) {
            $tree = $config['template']['tree'] ?? null;
            if (!is_array($tree)) return Reply::refused(__('This campaign has no design yet, so it takes no words. Choose a design in WConvert → Campaigns → Edit.', 'wconvert'));
            $copy = $this->copy($input['copy'], $tree);
            if ($copy instanceof WP_Error) return $copy;
            $config['template']['tree'] = SlotRoles::bind($tree, $copy, $this->vocabulary);
        }
        if (is_string($input['link'] ?? null) && $input['link'] !== '') $config = OptinConfigBuilder::linked($config, (string) $input['link']);
        $config = $this->colored($config, $input);
        return self::needs($config) ?? $config;
    }

    /**
     * The fields both writes take, as config keys, plus the occasion.
     *
     * @param array<string, mixed> $input
     * @param array<string, mixed>|null $stored
     * @return array{campaign: array<string, mixed>, occasion: string|null}|WP_Error
     */
    private function mapped(array $input, ?array $stored): array|WP_Error
    {
        $campaign = [];
        $occasion = is_string($stored['occasion'] ?? null) ? $stored['occasion'] : null;
        if (array_key_exists('occasion_id', $input)) {
            $occasion = (string) $input['occasion_id'] === '' ? null : (string) $input['occasion_id'];
            if ($occasion !== null && $this->occasions->find($occasion) === null) {
                return Reply::refused(__('No occasion has that occasion_id. List them with wconvert/list-occasions, or make one with wconvert/save-occasion.', 'wconvert'));
            }
        }
        foreach (['starts_at', 'ends_at'] as $key) {
            if (!array_key_exists($key, $input)) continue;
            $wall = self::wall((string) $input[$key]);
            if ($wall === null) {
                /* translators: %s: starts_at or ends_at. */
                return Reply::refused(sprintf(__('%s must be a date and time like "2026-11-20 00:00", in the site timezone, or "" for none.', 'wconvert'), $key));
            }
            $campaign[$key] = $wall;
        }
        // Inside an occasion and given no dates, a new campaign takes the occasion's (ADR 0149 §3).
        if ($stored === null && $occasion !== null && !isset($campaign['starts_at']) && !isset($campaign['ends_at'])) {
            $found = $this->occasions->find($occasion);
            if ($found !== null) $campaign += OccasionSchedule::of($found['start'], $found['end']);
        }
        if (is_string($input['link'] ?? null) && $input['link'] !== '') {
            if (!self::isLink((string) $input['link'])) return Reply::refused(__('link must be a full web address (https://…) or a path on this site starting with "/".', 'wconvert'));
            $campaign['link'] = (string) $input['link'];
        }
        if (is_array($input['pages'] ?? null)) {
            $targeting = self::targeting($input['pages']);
            if ($targeting instanceof WP_Error) return $targeting;
            $campaign['targeting'] = $targeting;
        }
        if (isset($input['inline_position'])) {
            $type = (string) ($input['display_type'] ?? $stored['display_type'] ?? $this->typeOf($input));
            if ($type !== 'inline') return Reply::refused(__('inline_position is only for an inline campaign. Leave it out for this display type.', 'wconvert'));
            $placement = ['position' => (string) $input['inline_position']];
            if ($placement['position'] === 'after_paragraph') {
                if (!isset($input['after_paragraph'])) return Reply::refused(__('Give after_paragraph, the paragraph number it follows (1 to 100).', 'wconvert'));
                $placement['paragraph'] = (int) $input['after_paragraph'];
            }
            $campaign['inline_placement'] = $placement;
        }
        if (is_array($input['frequency'] ?? null)) {
            $frequency = $input['frequency'];
            $campaign['frequency'] = array_filter([
                'maxPerSession' => isset($frequency['per_session']) ? (int) $frequency['per_session'] : null,
                'cooldownDays' => isset($frequency['cooldown_days']) ? (int) $frequency['cooldown_days'] : null,
                'maxImpressions' => isset($frequency['max_times']) ? (int) $frequency['max_times'] : null,
                'stopAfterDismiss' => isset($frequency['stop_after_close']) ? (bool) $frequency['stop_after_close'] : null,
            ], static fn ($value): bool => $value !== null);
        }
        return ['campaign' => $campaign, 'occasion' => $occasion];
    }

    /**
     * The words, checked against the roles this design takes.
     *
     * @param mixed $copy
     * @param mixed $tree
     * @return array<string, mixed>|WP_Error
     */
    private function copy(mixed $copy, mixed $tree): array|WP_Error
    {
        if ($copy === null || $copy === []) return [];
        if (!is_array($copy) || array_is_list($copy)) return Reply::refused(__('copy is a map of words by slot role, e.g. {"headline": "30% off everything"}.', 'wconvert'));
        $roles = SlotRoles::declaredIn($tree, $this->vocabulary);
        $unknown = array_values(array_diff(array_keys($copy), $roles));
        if ($unknown !== []) {
            /* translators: 1: the roles the agent named that the design has no slot for. 2: the roles the design takes. */
            return Reply::refused(sprintf(__('This design has no slot for %1$s. It takes: %2$s.', 'wconvert'), implode(', ', $unknown), implode(', ', $roles)), 'wconvert_agent_unknown_role');
        }
        foreach ($copy as $role => $words) {
            foreach (is_array($words) ? $words : [$words] as $text) {
                if (!is_string($text)) {
                    /* translators: %s: a slot role. */
                    return Reply::refused(sprintf(__('%s takes text, or a list of texts where the design repeats it.', 'wconvert'), $role));
                }
                if (wp_strip_all_tags($text) !== $text || preg_match('/<\/?[a-z!][^>]*>/i', $text) === 1) {
                    /* translators: %s: a slot role. */
                    return Reply::refused(sprintf(__('%s is plain text only; drop the HTML.', 'wconvert'), $role), 'wconvert_agent_markup');
                }
            }
        }
        return $copy;
    }

    /** @return array<string, mixed>|WP_Error */
    private function design(string $id): array|WP_Error
    {
        $entry = $this->library->find($id);
        if ($entry !== null) {
            if (!$this->builder->displayTypeRuns((string) ($entry['display_type'] ?? 'popup'))) return self::needsPro();
            return $entry;
        }
        return Reply::refused(__('That design is not on this site. Use a design_id from wconvert/find-designs.', 'wconvert'), 'wconvert_agent_unknown_design');
    }

    /** @return array<string, mixed>|WP_Error A starter's prefilled config. */
    private function starter(string $id, Goal $goal): array|WP_Error
    {
        $playbook = $this->playbooks->find($id);
        if ($playbook === null) return Reply::refused(__('No starter has that starter_id. Use one from wconvert/list-starters.', 'wconvert'), 'wconvert_agent_unknown_starter');
        if ($playbook->goal !== $goal) {
            /* translators: %s: a goal, e.g. promote_offer. */
            return Reply::refused(sprintf(__('That starter is for the goal %s. Use that goal, or pick a starter for yours with wconvert/list-starters.', 'wconvert'), $playbook->goal->value));
        }
        $availability = $this->index->entry($playbook)['availability'];
        if ($availability === 'locked' || !$this->builder->displayTypeRuns($playbook->displayType)) return self::needsPro();
        if ($availability !== 'ready') return Reply::refused(__('That starter needs a plugin this site does not have. Pick another with wconvert/list-starters.', 'wconvert'));
        $prefilled = $this->prefill->fromPlaybook($id);
        return $prefilled === null ? Reply::refused(__('That starter could not be prepared.', 'wconvert')) : $prefilled['config'];
    }

    /**
     * What the design needs that the agent left out.
     *
     * @param array<string, mixed> $config
     */
    private static function needs(array $config): ?WP_Error
    {
        if (DesignFacts::of($config['template']['tree'] ?? null)['has_countdown'] && !is_string($config['ends_at'] ?? null)) {
            return Reply::refused(__('This design counts down to the campaign\'s end. Give ends_at ("YYYY-MM-DD HH:MM"), or an occasion_id whose dates it takes.', 'wconvert'), 'wconvert_agent_needs_end');
        }
        return null;
    }

    /**
     * @param array<string, mixed> $config
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function colored(array $config, array $input): array
    {
        if (($input['use_site_colors'] ?? false) === true && is_array($config['template'] ?? null)) {
            $config['template']['tokens'] = array_replace(is_array($config['template']['tokens'] ?? null) ? $config['template']['tokens'] : [], ThemeTokens::fromSite());
        }
        return $config;
    }

    /**
     * Paths as targeting rules.
     *
     * @param array<string, mixed> $pages
     * @return array<string, mixed>|WP_Error
     */
    private static function targeting(array $pages): array|WP_Error
    {
        $rules = [];
        foreach (['show_on' => 'include', 'hide_on' => 'exclude'] as $field => $axis) {
            foreach ((array) ($pages[$field] ?? []) as $path) {
                if (!is_string($path) || !str_starts_with($path, '/') || strlen($path) > 500) {
                    /* translators: %s: show_on or hide_on. */
                    return Reply::refused(sprintf(__('%s takes paths on this site starting with "/", e.g. "/black-friday/*".', 'wconvert'), $field));
                }
                $rules[$axis][] = ['type' => 'url', 'value' => $path];
            }
        }
        foreach ((array) ($pages['show_on_types'] ?? []) as $type) {
            $rules['include'][] = ['type' => 'singular', 'value' => (string) $type];
        }
        return (isset($rules['include']) ? ['mode' => 'selected'] : []) + $rules;
    }

    /**
     * The display type a create will have, from the design or starter it names.
     *
     * @param array<string, mixed> $input
     */
    private function typeOf(array $input): string
    {
        if (isset($input['design_id'])) return (string) ($this->library->find((string) $input['design_id'])['display_type'] ?? 'popup');
        if (isset($input['starter_id'])) return (string) ($this->playbooks->find((string) $input['starter_id'])->displayType ?? 'popup');
        return 'popup';
    }

    /** A wall time in `Schedule::FORMAT`, from what an agent is likely to write; '' for none, null when unreadable. */
    private static function wall(string $value): ?string
    {
        $value = trim(str_replace('T', ' ', $value));
        if ($value === '') return '';
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value) === 1) $value .= ' 00:00';
        $value = preg_replace('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):\d{2}$/D', '$1', $value) ?? $value;
        $parsed = \DateTimeImmutable::createFromFormat('!' . Schedule::FORMAT, $value);
        return $parsed !== false && $parsed->format(Schedule::FORMAT) === $value ? $value : null;
    }

    private static function isLink(string $link): bool
    {
        if (strlen($link) > 2000) return false;
        if (str_starts_with($link, '/') && !str_starts_with($link, '//')) return true;
        return preg_match('#^https?://[^\s/$.?\#].[^\s]*$#i', $link) === 1;
    }

    private static function needsPro(): WP_Error
    {
        return Reply::refused(__('That design needs WConvert Pro, which this site does not have. Pick one from wconvert/find-designs, which lists only designs this site can run.', 'wconvert'), 'wconvert_agent_needs_pro');
    }
}
