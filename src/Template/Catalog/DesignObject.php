<?php

namespace WConvert\Template\Catalog;

use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * One v3 design or setup object, unwrapped into the internal pack the strict
 * validator reads (ADR 0156).
 *
 * ============================================================================
 * TOLERANT OUTSIDE, STRICT INSIDE.
 * ============================================================================
 * After free-v1 ships every installed reader is frozen, so a key a later
 * publisher adds must not make an old plugin refuse the design. The envelope
 * and `meta` therefore DROP keys they do not know. The tree, tokens, rules,
 * images and bindings are the security boundary of ADR 0082 and are passed
 * through untouched, so an unknown key there is still a refusal: a design can
 * deliver content and never capability.
 *
 * An unknown `tier` or `display_type` is "unsupported", never "free". A word
 * this reader cannot place is a design it cannot honestly classify.
 */
final class DesignObject
{
    public const SCHEMA = 3;
    /** The minor version this reader was built for; a higher one is still read. */
    public const MINOR = 1;

    private const DESIGN_KEYS = ['schema', 'minor', 'id', 'revision', 'name', 'display_type', 'tier', 'family', 'meta', 'requires', 'assets', 'image_bindings', 'tree', 'tokens'];
    private const SETUP_KEYS = ['schema', 'minor', 'id', 'revision', 'name', 'tier', 'design', 'requires', 'playbook'];
    private const META_KEYS = ['description', 'slug', 'industries', 'occasions', 'style', 'colour'];
    public const FORMATS = ['inline', 'popup', 'floating_bar', 'slide_in', 'fullscreen'];

    /**
     * @return array{pack: array<string, mixed>, design: array<string, mixed>}
     *         the strict internal pack, and the envelope facts that ride beside it
     */
    public static function design(string $json, string $sha256): array
    {
        $object = self::decode($json, $sha256);
        PackValidator::check(PackValidator::identifier($object['id'] ?? null) && self::revision($object['revision'] ?? null), __('This design has an invalid identity.', 'wconvert'));
        PackValidator::words($object['name'] ?? null, 120);
        PackValidator::check(Tier::tryFrom((string) ($object['tier'] ?? '')) !== null && in_array($object['display_type'] ?? null, self::FORMATS, true), __('This design needs a format or plan this version of WConvert does not know. Update WConvert to use it.', 'wconvert'));
        $requires = self::requires($object['requires'] ?? null, true);
        $template = ['id' => $object['id'], 'name' => $object['name'], 'display_type' => $object['display_type'], 'tier' => $object['tier'], 'tree' => $object['tree'] ?? null, 'tokens' => $object['tokens'] ?? null];
        $bindings = [];
        foreach (is_array($object['image_bindings'] ?? null) ? $object['image_bindings'] : [] as $binding) {
            PackValidator::check(is_array($binding), __('Invalid image binding.', 'wconvert'));
            PackValidator::keys($binding, ['slot', 'asset_id']);
            $bindings[] = ['template_id' => $object['id']] + $binding;
        }
        $pack = ['schema' => 2, 'id' => $object['id'], 'version' => '1.0.0', 'name' => $object['name'], 'description' => '',
            'requires' => $requires, 'assets' => $object['assets'] ?? [], 'templates' => [$template]];
        if ($bindings !== []) $pack['image_bindings'] = $bindings;
        return ['pack' => $pack, 'design' => [
            'id' => $object['id'], 'revision' => $object['revision'], 'sha256' => $sha256,
            'family' => PackValidator::identifier($object['family'] ?? null) ? $object['family'] : null,
            'meta' => self::meta($object['meta'] ?? null),
        ]];
    }

    /**
     * A setup pins one design revision; its words and rules join that design's
     * internal pack so they are validated against the exact tree they bind to.
     *
     * @param array<string, mixed> $designPack the pinned design's strict pack
     * @return array{pack: array<string, mixed>, setup: array<string, mixed>}
     */
    public static function setup(string $json, string $sha256, array $designPack, int $designRevision): array
    {
        $object = self::decode($json, $sha256);
        PackValidator::check(PackValidator::identifier($object['id'] ?? null) && self::revision($object['revision'] ?? null), __('This campaign setup has an invalid identity.', 'wconvert'));
        PackValidator::words($object['name'] ?? null, 120);
        PackValidator::check(Tier::tryFrom((string) ($object['tier'] ?? '')) !== null, __('This campaign setup needs a plan this version of WConvert does not know. Update WConvert to use it.', 'wconvert'));
        $design = $object['design'] ?? null;
        PackValidator::check(is_array($design) && ($design['id'] ?? null) === $designPack['templates'][0]['id'] && ($design['revision'] ?? null) === $designRevision, __('This campaign setup belongs to a different design revision.', 'wconvert'));
        $requires = self::requires($object['requires'] ?? null, false);
        $playbook = $object['playbook'] ?? null;
        PackValidator::check(is_array($playbook), __('This pack contains an invalid campaign setup.', 'wconvert'));
        $playbook = ['id' => $object['id'], 'name' => $object['name'], 'template_id' => $design['id']] + $playbook;
        $pack = $designPack;
        $pack['requires']['capabilities'] = array_values(array_unique(array_merge($pack['requires']['capabilities'], $requires['capabilities'])));
        $pack['playbooks'] = [$playbook];
        return ['pack' => $pack, 'setup' => ['id' => $object['id'], 'revision' => $object['revision'], 'sha256' => $sha256, 'tier' => $object['tier']]];
    }

    /** @return array<string, mixed> */
    private static function decode(string $json, string $sha256): array
    {
        PackValidator::check(strlen($json) <= PackValidator::MAX_BYTES, __('This design is too large.', 'wconvert'));
        PackValidator::check(hash_equals($sha256, hash('sha256', $json)), __('The downloaded design did not match the catalog. Refresh and try again.', 'wconvert'));
        $object = json_decode($json, true, 48);
        PackValidator::check(is_array($object) && ($object['schema'] ?? null) === self::SCHEMA && is_int($object['minor'] ?? null) && $object['minor'] >= 0, __('Update WConvert to use this design.', 'wconvert'));
        return array_intersect_key($object, array_flip(array_merge(self::DESIGN_KEYS, self::SETUP_KEYS)));
    }

    /**
     * `requires` is checked here, before the strict reader sees it, so that a
     * design a newer plugin is needed for says so rather than "invalid".
     *
     * @return array{plugin: string, tree: int, capabilities: list<string>}
     */
    private static function requires(mixed $requires, bool $design): array
    {
        PackValidator::check(is_array($requires) && PackValidator::version($requires['plugin'] ?? null), __('This design does not declare compatibility.', 'wconvert'));
        PackValidator::check(version_compare(WCONVERT_VERSION, $requires['plugin'], '>='), __('Update WConvert to use this design.', 'wconvert'));
        $capabilities = $requires['capabilities'] ?? null;
        PackValidator::check(is_array($capabilities) && array_is_list($capabilities) && count($capabilities) <= 20, __('This design has invalid requirements.', 'wconvert'));
        foreach ($capabilities as $capability) PackValidator::check(is_string($capability) && in_array($capability, PackValidator::CAPABILITIES, true), __('Update WConvert to use this design.', 'wconvert'));
        $tree = $requires['tree'] ?? ($design ? null : 2);
        PackValidator::check(in_array($tree, [2, 3], true), __('Update WConvert to use this design.', 'wconvert'));
        return ['plugin' => $requires['plugin'], 'tree' => $tree, 'capabilities' => $capabilities];
    }

    /**
     * Authored catalogue words. Display only — nothing here reaches a tree —
     * so an unknown key is dropped and a malformed value is simply absent.
     *
     * @return array<string, mixed>
     */
    public static function meta(mixed $meta): array
    {
        if (!is_array($meta)) return [];
        $clean = [];
        foreach (array_intersect_key($meta, array_flip(self::META_KEYS)) as $key => $value) {
            if (in_array($key, ['description', 'slug'], true)) {
                if (is_string($value) && strlen($value) <= ($key === 'slug' ? 80 : 1000) && !preg_match('/[<>\x00-\x1f]/', $value)) $clean[$key] = $value;
                continue;
            }
            if (is_array($value) && array_is_list($value)) {
                $clean[$key] = array_values(array_filter(array_slice($value, 0, 20), [PackValidator::class, 'identifier']));
            }
        }
        return $clean;
    }

    public static function revision(mixed $value): bool
    {
        return is_int($value) && $value >= 1 && $value <= 1000000;
    }
}
