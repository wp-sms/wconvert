<?php

namespace WConvert\Agent;

use WP_Error;

defined('ABSPATH') || exit;

/**
 * WConvert's [[Agent ability]] set, registered with WordPress and, where the
 * MCP Adapter is running, served as an MCP server of its own (ADR 0154).
 *
 * ============================================================================
 * EVERY PIECE IS OPTIONAL, AND ASKED FOR WHERE IT IS USED.
 * ============================================================================
 * The Abilities API is WordPress 6.9's and the plugin's floor is 6.8, so each
 * registration is guarded by the function it calls. The Adapter is a plugin
 * (or WooCommerce's bundled copy) WConvert never starts itself: when it runs,
 * it fires `mcp_adapter_init` and WConvert adds its server; when it does not,
 * the abilities still answer over REST at `/wp-abilities/v1`.
 *
 * Booting adds three hooks and builds nothing, so it translates nothing on
 * `plugins_loaded` (#52). The abilities themselves are built on
 * `wp_abilities_api_init`, which WordPress fires the first time the registry
 * is read.
 */
final class Abilities
{
    public const CATEGORY = 'wconvert';

    /** The MCP server's id, and its route under `/wp-json/wconvert/mcp`. */
    public const SERVER = 'wconvert';

    /**
     * Every ability by name, in the order an agent meets them.
     *
     * @var list<string>
     */
    public const NAMES = [
        'wconvert/find-campaigns',
        'wconvert/get-campaign',
        'wconvert/list-occasions',
        'wconvert/get-occasion',
        'wconvert/find-designs',
        'wconvert/list-starters',
        'wconvert/review-campaign',
        'wconvert/get-stats',
    ];

    /**
     * @param \Closure(): iterable<Ability> $build
     * @param (callable(string): bool)|null $exists Asks whether WordPress has a function; a test's WordPress 6.8 has none.
     */
    public static function hooks(\Closure $build, ?callable $exists = null): void
    {
        $exists ??= 'function_exists';
        if ($exists('wp_register_ability_category')) {
            add_action('wp_abilities_api_categories_init', [self::class, 'registerCategory']);
        }
        if ($exists('wp_register_ability')) {
            add_action('wp_abilities_api_init', static function () use ($build): void {
                foreach ($build() as $ability) {
                    self::register($ability);
                }
            });
            add_action('mcp_adapter_init', [self::class, 'registerServer']);
        }
    }

    public static function registerCategory(): void
    {
        wp_register_ability_category(self::CATEGORY, [
            'label' => __('WConvert campaigns', 'wconvert'),
            'description' => __('Read WConvert campaigns, occasions, designs and stats; make draft campaigns; publish or pause them when the site allows it.', 'wconvert'),
        ]);
    }

    public static function register(Ability $ability): void
    {
        $definition = $ability->definition();
        wp_register_ability($ability->name(), [
            'label' => $definition['label'],
            'description' => $definition['description'],
            'category' => self::CATEGORY,
            'input_schema' => $definition['input_schema'],
            'output_schema' => ['type' => 'object'],
            'execute_callback' => static function ($input = null) use ($ability) {
                $reply = $ability->execute(is_array($input) ? $input : []);
                return $reply instanceof WP_Error ? $reply : Reply::guard($reply);
            },
            'permission_callback' => static fn ($input = null): bool|WP_Error => $ability->permitted(is_array($input) ? $input : []),
            'meta' => [
                'annotations' => $definition['annotations'],
                // 6.9 reads `show_in_rest` alone; 7.1 also reads `public`.
                'show_in_rest' => true,
                'public' => true,
                'mcp' => ['public' => true],
            ],
        ]);
    }

    /** @param object $adapter The Adapter's `McpAdapter`, typed loosely because the class may not exist. */
    public static function registerServer($adapter): void
    {
        if (!class_exists(\WP\MCP\Core\McpAdapter::class) || !$adapter instanceof \WP\MCP\Core\McpAdapter) {
            return;
        }
        try {
            $result = $adapter->create_server(
                self::SERVER,
                self::SERVER,
                'mcp',
                'WConvert',
                'WConvert campaigns: read campaigns, occasions, designs and stats; make drafts; publish or pause only when the site allows agents to.',
                WCONVERT_VERSION,
                [\WP\MCP\Transport\HttpTransport::class],
                \WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class,
                \WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler::class,
                self::NAMES,
            );
        } catch (\Throwable $failed) {
            $result = new WP_Error('wconvert_mcp_server', $failed->getMessage());
        }
        if ($result instanceof WP_Error) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- the Adapter has no surface of its own to report a refused server on.
            error_log('[WConvert] The MCP server could not be added: ' . $result->get_error_message());
        }
    }
}
