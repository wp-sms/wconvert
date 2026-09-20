<?php
namespace WConvert\Pro\Module\ContentLock;

use WConvert\Frontend\ContentRegion;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * Resolves one explicit divider within main post content, before WordPress renders blocks.
 * @phpstan-type ParsedBlock array{blockName: string|null, attrs: array<string, mixed>, innerBlocks: array<array<string, mixed>>, innerHTML: string, innerContent: array<string|null>}
 */
final class ContentDivider
{
    public const BLOCK = 'wconvert/content-lock-divider';

    public static function hooks(): void
    {
        add_action('init', static function (): void {
            register_block_type(self::BLOCK, [
                'api_version' => version_compare((string) get_bloginfo('version'), '6.3', '>=') ? 3 : 2,
                'title' => __('WConvert Lock from here', 'wconvert'),
                'description' => __('Reveal the rest of this article after a successful form submission.', 'wconvert'),
                'category' => 'widgets',
                'attributes' => ['optinId' => ['type' => 'string', 'default' => '']],
                'supports' => ['html' => false, 'multiple' => false, 'reusable' => false],
                'editor_script' => 'wconvert-content-lock-editor',
                'editor_style' => 'wconvert-content-lock-editor',
                // The marker itself never outputs HTML; following blocks own their content.
                'render_callback' => static fn (array $attributes, string $content): string => $content,
            ]);
        });
        add_filter('the_content', [self::class, 'content'], 8);
    }

    public static function content(string $content): string
    {
        if (!str_contains($content, 'wp:' . self::BLOCK) || strlen($content) > 1048576) return $content;
        if (is_admin() || is_feed() || is_preview() || (defined('REST_REQUEST') && REST_REQUEST)
            || !is_singular(['post', 'page']) || !in_the_loop() || !is_main_query() || post_password_required()
            || get_the_ID() !== get_queried_object_id()) return $content;
        // Pagination and More can split content before this filter sees it.
        $original = get_post_field('post_content', get_the_ID());
        if (!is_string($original)) return $content;
        if (!str_contains($original, 'wp:' . self::BLOCK) || str_contains($original, '<!--nextpage-->') || str_contains($original, '<!--more')
            || str_contains($original, '[' . ContentRegion::SHORTCODE)) return $content;
        $blocks = array_values(parse_blocks($content));
        $wrapped = self::wrap($blocks);
        return $wrapped === $blocks ? $content : serialize_blocks($wrapped);
    }

    /**
     * @param list<ParsedBlock> $blocks
     * @return list<ParsedBlock>
     */
    public static function wrap(array $blocks): array
    {
        if (self::count($blocks, self::BLOCK) !== 1 || self::count($blocks, ContentRegion::BLOCK) > 0
            || self::count($blocks, 'core/nextpage') > 0 || self::count($blocks, 'core/more') > 0) return $blocks;
        $indices = array_keys(array_filter($blocks, static fn (array $block): bool => ($block['blockName'] ?? '') === self::BLOCK));
        if (count($indices) !== 1) return $blocks;
        $index = $indices[0];
        $marker = $blocks[$index];
        if ($marker['innerBlocks'] !== [] || trim($marker['innerHTML']) !== '') return $blocks;
        $id = $marker['attrs']['optinId'] ?? null;
        if (!is_string($id) || !Ulid::isOne($id)) return $blocks;
        $remaining = array_slice($blocks, $index + 1);
        $schemaPath = __DIR__ . '/../static-blocks.json';
        if (!is_readable($schemaPath)) return $blocks;
        $schema = json_decode((string) file_get_contents($schemaPath), true);
        if (!is_array($schema) || !isset($schema['top'], $schema['children'])
            || !is_array($schema['top']) || !is_array($schema['children'])) return $blocks;
        if (!self::supported($remaining, array_values($schema['top']), $schema['children']) || !self::meaningful($remaining)) return $blocks;
        return [...array_slice($blocks, 0, $index), [
            'blockName' => ContentRegion::BLOCK, 'attrs' => $marker['attrs'],
            'innerBlocks' => $remaining, 'innerHTML' => '',
            'innerContent' => array_fill(0, count($remaining), null),
        ]];
    }

    /**
     * @param list<array<string, mixed>> $blocks
     */
    private static function count(array $blocks, string $name): int
    {
        $count = 0;
        foreach ($blocks as $block) $count += (int) (($block['blockName'] ?? '') === $name) + self::count($block['innerBlocks'] ?? [], $name);
        return $count;
    }

    /**
     * @param list<array<string, mixed>> $blocks
     * @param list<string> $allowed
     * @param array<string, list<string>> $children
     */
    private static function supported(array $blocks, array $allowed, array $children): bool
    {
        foreach ($blocks as $block) {
            $name = $block['blockName'] ?? '';
            $html = $block['innerHTML'] ?? '';
            if ($name === '' && trim($html) === '') continue;
            if (!in_array($name, $allowed, true) || !empty($block['attrs']['metadata']['bindings'])
                || preg_match('/<(?:form|iframe|script|video|audio|object|embed)\b|\[\/?[a-zA-Z]/i', $html)
                || !self::supported($block['innerBlocks'] ?? [], $children[$name] ?? [], $children)) return false;
        }
        return true;
    }

    /**
     * @param list<array<string, mixed>> $blocks
     */
    private static function meaningful(array $blocks): bool
    {
        foreach ($blocks as $block) {
            $html = $block['innerHTML'] ?? '';
            $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (preg_match('/<img\b/i', $html) || (preg_replace('/[\s\x{00a0}\x{200b}]+/u', '', $text) ?? '') !== ''
                || self::meaningful($block['innerBlocks'] ?? [])) return true;
        }
        return false;
    }
}
