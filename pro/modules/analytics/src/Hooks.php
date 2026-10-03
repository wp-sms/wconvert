<?php
namespace WConvert\Pro\Module\Analytics;

use WConvert\Assets\BuiltAsset;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Pro\Boot\PageCache;
use WConvert\Rest\Routes;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

final class Hooks
{
    public const HANDLE = 'wconvert-analytics';
    /** @var list<array<string, mixed>> */
    private array $entries = [];
    public function __construct(private readonly Settings $settings, private readonly PublishedSet $published, private readonly OptinRepository $optins) {}

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'routes']);
        add_action('wconvert_published_set_changed', [PageCache::class, 'purge']);
        add_action('wconvert_frontend_entries', [$this, 'observeEntries']);
        add_action('template_redirect', function (): void {
            if (!$this->diagnostic()) return;
            if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
            nocache_headers();
        });
        // Free resolves candidates at 10; Pro selects its loader at 20.
        add_action('wp_enqueue_scripts', [$this, 'enqueue'], LoaderEnqueue::PRIORITY + 5);
        add_filter('wconvert_pro_loader_dependencies', function (array $deps): array {
            if (wp_script_is(self::HANDLE, 'enqueued')) $deps[] = self::HANDLE;
            return $deps;
        });
        add_filter('wconvert_analytics_privacy', function (): array {
            $value = $this->settings->read();
            return ['configured' => $value['enabled'], 'route' => $value['route'], 'consent' => $value['consent']];
        });
    }

    /** @param list<array<string, mixed>> $entries */
    public function observeEntries(array $entries): void
    {
        $this->entries = $entries;
    }

    public function routes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/analytics-integration', [
            ['methods' => 'GET', 'callback' => [$this, 'show'], 'permission_callback' => [Routes::class, 'canManage']],
            ['methods' => 'POST', 'callback' => [$this, 'save'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
    }

    public function show(): WP_REST_Response
    {
        $value = $this->settings->read();
        $excluded = count(array_filter($this->published->all(), static fn (array $entry): bool => !empty($entry['analytics']['off'])));
        return new WP_REST_Response(['settings' => array_diff_key($value, ['home' => 1, 'version' => 1]),
            'home' => home_url('/'), 'environment' => wp_get_environment_type(),
            'site_matches' => $value['home'] === rtrim(home_url('/'), '/'), 'excluded' => $excluded,
            'guide_url' => WCONVERT_PRO_URL . 'docs/analytics-integrations.html',
            'asset_available' => is_file(WCONVERT_PRO_DIR . 'public/analytics/analytics.js'),
            'test_url' => add_query_arg('wconvert-analytics', '1', home_url('/'))]);
    }

    public function save(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $body = $request->get_json_params();
        if (strlen($request->get_body()) > 4096 || !is_array($body)) return new WP_Error('wconvert_analytics_input', __('Invalid analytics settings.', 'wconvert'), ['status' => 422]);
        try { $this->settings->save($body, home_url('/')); }
        catch (\InvalidArgumentException $error) { return new WP_Error('wconvert_analytics_input', $error->getMessage(), ['status' => 422]); }
        $this->optins->rebuildForInstall();
        return $this->show();
    }

    private function diagnostic(): bool
    {
        // A manager-only inspection page. This flag never authorizes a visitor.
        return Routes::canManage() && isset($_GET['wconvert-analytics']);
    }
    private function enabled(): bool
    {
        return $this->settings->active(home_url('/'), wp_get_environment_type(), Routes::canManage());
    }

    public function enqueue(): void
    {
        if (is_admin() || is_preview() || is_feed() || is_embed() || is_robots()) return;
        $debug = $this->diagnostic();
        if (!$debug && (!$this->enabled() || $this->entries === [])) return;
        $path = WCONVERT_PRO_DIR . 'public/analytics/analytics.js';
        if (!is_file($path)) return;
        $campaigns = Metadata::forEntries($this->entries, $this->published->all());
        if (!$debug && $campaigns === []) return;
        $settings = $this->settings->read();
        $config = array_intersect_key($settings, array_flip(['route', 'measurement_id', 'consent', 'dismissals', 'data_layer']));
        $config['campaigns'] = $campaigns;
        $config['debug'] = $debug;
        $config['dry_run'] = $debug;
        if ($debug) {
            $config['environment'] = wp_get_environment_type();
            $config['labels'] = [__('Analytics check', 'wconvert'), __('Local inspection only. Campaign activity is not sent from this test page.', 'wconvert'),
                __('Send synthetic test event', 'wconvert'), __('Test stream Measurement ID (G-…)', 'wconvert'),
                __('GTM sends to the stream configured in your container. Use a test workspace/property.', 'wconvert'),
                __('Handed off does not confirm receipt. Verify wconvert_test in GA DebugView or Realtime.', 'wconvert'),
                __('Close analytics check', 'wconvert'), __('Consent delegated to the existing Google tag / GTM', 'wconvert')];
            $config['statuses'] = [
                'handed_off' => __('Handed off; verify receipt in GA', 'wconvert'),
                'consent_unknown' => __('Consent is not initialized', 'wconvert'),
                'consent_withheld' => __('Statistics consent withheld', 'wconvert'),
                'tag_unavailable' => __('Existing tag, data layer or stream is unavailable', 'wconvert'),
                'ignored' => __('Excluded or not an enabled event', 'wconvert'),
                'dry_run' => __('Observed locally; not sent', 'wconvert'),
                'failed' => __('The site tag failed', 'wconvert'),
                'prerender' => __('Prerendered page; not sent', 'wconvert'),
            ];
        }
        add_action('wp_head', static function () use ($config): void {
            echo '<script type="application/json" id="wconvert-analytics-config">' . wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }, 6);
        wp_enqueue_script(self::HANDLE, WCONVERT_PRO_URL . 'public/analytics/analytics.js', [], BuiltAsset::version($path), true);
    }
}
