<?php

namespace WConvert\Privacy;

use WConvert\Goal\Goal;
use WConvert\Storage\OptionStore;
use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/**
 * How much privacy help WConvert adds while a merchant creates a Campaign.
 *
 * This is one site-wide WordPress option, not a database column and not part
 * of an [[Optin]]. It changes the starting point copied into a NEW draft and
 * the editor guidance around that draft. Existing Optins keep their snapshots
 * exactly as they are.
 *
 * The setting never disables privacy infrastructure. Export, erasure,
 * retention, Consent Records, the WordPress policy suggestion and the Data Map
 * do not consult it.
 *
 * @since 0.1.0
 */
final class PrivacyGuidance
{
    public const OPTION = 'wconvert_privacy_guidance';

    public function __construct(private readonly OptionStore $options)
    {
    }

    /** Guidance is on until the merchant explicitly turns it off. */
    public function enabled(): bool
    {
        $stored = $this->options->get(self::OPTION, true);

        return !in_array($stored, [false, 0, '0', ''], true);
    }

    public function set(bool $enabled): void
    {
        // WordPress serializes boolean false as an empty option value. Store
        // explicit integers so an off preference survives a real DB round trip.
        $this->options->set(self::OPTION, $enabled ? 1 : 0);
    }

    /**
     * The copy a new Campaign setup receives under the current preference.
     *
     * A Playbook's link with no address is the site's Privacy Policy link
     * (ADR 0032). When guidance is off, those automatic notices and the
     * automatic consent wording are left out. A list keeps null placeholders
     * so repeated Slot Roles stay aligned: removing item zero must not move a
     * success-screen sentence into the form's fine-print slot.
     *
     * @param array<string, mixed> $copy
     * @return array<string, mixed>
     */
    public function copyFor(array $copy): array
    {
        if ($this->enabled()) {
            return $copy;
        }

        unset($copy['consent_text']);

        if (!array_key_exists('fine_print', $copy)) {
            return $copy;
        }

        $finePrint = $copy['fine_print'];

        if (self::hasPolicyLink($finePrint)) {
            unset($copy['fine_print']);

            return $copy;
        }

        if (is_array($finePrint) && $finePrint === array_values($finePrint)) {
            $copy['fine_print'] = array_map(
                static fn ($words) => self::hasPolicyLink($words) ? null : $words,
                $finePrint
            );
        }

        return $copy;
    }

    /**
     * Apply the Goal's privacy starting point to a newly selected design.
     *
     * The Template only supplies the control; the Campaign purpose decides
     * whether that control starts visible. Ongoing email and SMS lists show
     * explicit consent. One-time requests keep the same control available in
     * the editor but hidden, and click-only designs have no such node to edit.
     *
     * This runs only at a draft's existing snapshot boundaries. It never
     * changes an already saved Campaign behind the merchant's back.
     *
     * @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    public function treeFor(array $tree, Goal $goal): array
    {
        if (!$this->enabled()) {
            return $tree;
        }

        $showConsent = $goal->outcome()->audienceChannel !== null;
        $payload = TemplateTree::rewrittenIn(
            ['template' => ['tree' => $tree]],
            static function (array $node) use ($showConsent): array {
                if (($node['type'] ?? null) !== 'consent') {
                    return $node;
                }

                // A third-party starting point may omit consent wording. Do
                // not reveal a blank required checkbox merely because its Goal
                // grows a list; the publish review will point that omission out.
                $hasWords = is_string($node['text'] ?? null) && trim($node['text']) !== '';
                $node['hidden'] = !$showConsent || !$hasWords;

                return $node;
            }
        );

        /** @var array<string, mixed> $rewritten */
        $rewritten = $payload['template']['tree'];

        return $rewritten;
    }

    /** @param mixed $words */
    private static function hasPolicyLink($words): bool
    {
        return is_array($words) && is_array($words['link'] ?? null);
    }
}
