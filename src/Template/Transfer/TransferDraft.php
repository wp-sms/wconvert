<?php
namespace WConvert\Template\Transfer;

use WConvert\Template\{TemplateVocabulary, SlotRoles, MerchantsOwn, PictureTransfer, CaptureJourney};
use WConvert\Template\Catalog\PackValidator;

defined('ABSPATH') || exit;

/** Prepare one replacement patch; no persistence, publication or connection creation. */
final class TransferDraft
{
    /**
     * @param array<string, mixed> $incoming
     * @param array<string, mixed> $config
     * @param array<string, mixed>|null $original
     *
     * @return array{patch: array<string, mixed>, notes: list<string>}
     */
    public static function prepare(array $incoming, array $config, bool $keep, ?array $original, TemplateVocabulary $vocabulary): array
    {
        $template = ['tree' => $incoming['tree'], 'tokens' => $incoming['tokens']];
        $notes = [];
        if ($keep) {
            $mine = $vocabulary->normalize($config['template'] ?? []);
            $copy = SlotRoles::copyFrom($mine['tree'], $vocabulary);
            $template['tree'] = MerchantsOwn::writeInto(SlotRoles::bind($vocabulary->withoutCopy($template['tree']), $copy, $vocabulary), MerchantsOwn::changedIn($mine['tree'], $original['tree'] ?? []));
            // Content binding predates graph journeys; routing belongs to the incoming design.
            if (($incoming['tree']['v'] ?? null) === 3) {
                $template['tree']['v'] = 3;
                $template['tree']['graph'] = $incoming['tree']['graph'];
            }
            $pictures = PictureTransfer::prepare($mine, $original ?? ['tree' => ['steps' => []], 'tokens' => []], $template);
            $template = $pictures['template'];
            if ($pictures['unplaced'] || $pictures['unverified']) $notes[] = __('Some current pictures could not be matched confidently. Review every screen.', 'wconvert');
            $notes[] = __('Only matching content slots are kept. Review every screen for missing words or pictures.', 'wconvert');
        }
        $template['tree'] = self::freshNodes($template['tree'], $config['template']['tree'] ?? []);
        $patch = ['template' => $template, 'template_id' => null, 'display_type' => $incoming['display_type'], 'submission_settings' => [], 'integration_mappings' => []];
        if (!empty($config['submission_settings']) || !empty($config['integration_mappings'])) $notes[] = __('Form-specific delivery settings and field mappings will be cleared. Review Destinations after importing.', 'wconvert');
        if (($config['display_type'] ?? 'popup') !== $incoming['display_type']) {
            $patch += ['placement' => null, 'inline_placement' => null, 'content_lock' => null];
            if (!in_array($incoming['display_type'], ['popup', 'slide_in'], true)) $patch['teaser'] = null;
            $notes[] = __('The display format changes. Placement and content-lock settings will be reset.', 'wconvert');
        }
        if (!empty($config['content_lock']) && ($incoming['display_type'] !== 'inline' || \WConvert\Template\ConvertingAct::offeredIn($template['tree']) !== [\WConvert\Template\ConvertingAct::Submit] || ($template['tree']['steps'][array_key_last($template['tree']['steps'])]['kind'] ?? '') !== 'acknowledgement')) {
            $patch['content_lock'] = null;
            $notes[] = __('Content locking is not compatible with this design and will be cleared.', 'wconvert');
        }
        return ['patch' => $patch, 'notes' => $notes];
    }

    /** Validate the transformed draft without imposing the archive's empty-image policy.
     * @param array<string, mixed> $patch
     */
    public static function validate(array $patch, string $name, PackValidator $validator): void
    {
        $design = $patch['template'] + ['name' => $name, 'display_type' => $patch['display_type']];
        foreach (DesignImages::slots($design) as $slot) {
            DesignImages::put($design, $slot['path'], $slot['background'] ? 'none' : '');
        }
        $validator->portable($design);
    }

    /**
     * @param array<string, mixed> $tree
     * @param array<string, mixed> $old
     * @return array<string, mixed> */
    private static function freshNodes(array $tree, array $old): array
    {
        $next = 1;
        foreach ($old['steps'] ?? [] as $screen) foreach (CaptureJourney::nodes($screen['content'] ?? []) as $node) {
            if (preg_match('/^n([0-9]+)$/', (string) ($node['id'] ?? ''), $match)) $next = max($next, (int) $match[1] + 1);
        }
        $map = [];
        foreach ($tree['steps'] as $screen) foreach (CaptureJourney::nodes($screen['content']) as $node) {
            if (isset($node['id'])) {
                PackValidator::check($next <= 9999, __('This campaign has exhausted its block identities. Import into a new campaign.', 'wconvert'));
                $map[$node['id']] = 'n' . $next++;
            }
        }
        $rewrite = static function (array $value) use (&$rewrite, $map): array {
            if (isset($value['type'], $value['id'], $map[$value['id']])) $value['id'] = $map[$value['id']];
            if (isset($value['question'], $map[$value['question']])) $value['question'] = $map[$value['question']];
            foreach (['fields', 'consents'] as $key) if (isset($value[$key]) && is_array($value[$key])) $value[$key] = array_map(static fn (string $id): string => $map[$id] ?? $id, $value[$key]);
            foreach ($value as $key => $item) if (is_array($item)) $value[$key] = $rewrite($item);
            return $value;
        };
        return $rewrite($tree);
    }

    /**
     * @param array<string, mixed> $template
     * @return list<array{url: string, uses: int}> */
    public static function links(array $template): array
    {
        $found = [];
        $walk = static function (array $node) use (&$walk, &$found): void {
            foreach ($node as $key => $value) {
                if ($key === 'href' && is_string($value) && $value !== '') { PackValidator::portableUrl($value); $found[$value] = ($found[$value] ?? 0) + 1; }
                elseif (is_array($value)) $walk($value);
            }
        };
        $walk($template);
        $links = [];
        foreach ($found as $url => $uses) $links[] = ['url' => (string) $url, 'uses' => $uses];
        return $links;
    }

    /**
     * @param array<string, mixed> $template
     * @param array<string, string> $replacements
     * @return array<string, mixed> */
    public static function replaceLinks(array $template, array $replacements): array
    {
        foreach ($replacements as $url) PackValidator::portableUrl($url);
        foreach ($template as $key => $value) {
            if ($key === 'href' && is_string($value) && isset($replacements[$value])) $template[$key] = $replacements[$value];
            elseif (is_array($value)) $template[$key] = self::replaceLinks($value, $replacements);
        }
        return $template;
    }
}
