<?php
namespace WConvert\Pro\Module\Analytics;

use WConvert\Optin\PublishedSet;
use WConvert\Lead\LeadRepository;
use WConvert\Rest\Routes;
use WConvert\Rest\RateLimit;
use WConvert\Storage\OptionStore;
use WConvert\Assets\BuiltAsset;
use WConvert\Pro\Boot\PageCache;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

defined('ABSPATH') || exit;

final class RevenueHooks
{
    public const OPTION = 'wconvert_revenue';
    private const HANDLE = 'wconvert-revenue';
    /** @var list<array<string, mixed>> */
    private array $entries = [];
    public function __construct(private readonly OptionStore $options, private readonly PublishedSet $published, private readonly LeadRepository $leads, private readonly RateLimit $limit, private readonly \WConvert\Rules\Degradation $degradation) {}

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'routes']);
        add_action('wp_loaded', function (): void {
            try {
                if (!function_exists('WC') || !WC()->session) return;
                $pending = WC()->session->get(Attribution::KEY);
                if ($pending !== null && (!$this->active() || !Attribution::consent() || !is_array($pending) || !Attribution::eligible($pending, time()))) {
                    WC()->session->__unset(Attribution::KEY);
                    WC()->session->save_data();
                }
            } catch (\Throwable) { /* Optional cleanup cannot block the page. */ }
        }, 40);

        add_action('wconvert_frontend_entries', function (array $entries): void { $this->entries = array_values($entries); });
        add_action('wp_enqueue_scripts', [$this, 'enqueue'], 15);
        add_filter('wconvert_pro_loader_dependencies', static function (array $deps): array { if (wp_script_is(self::HANDLE, 'enqueued')) $deps[] = self::HANDLE; return $deps; });
        add_action('wconvert_cart_addition_accepted', function (string $id): void { $this->remember($id, false, null, true); });
        add_action('wc_ajax_wconvert_interaction', [$this, 'interaction']);
        add_action('wconvert_submission_accepted', function (string $id): void {
            try {
                if (!$this->active() || !Attribution::consent()) return;
                $lead = $this->leads->find($id);
                if ($lead !== null && count($lead->capture['submissions'] ?? []) === 1) $this->remember($lead->optinId, true);
            } catch (\Throwable) { /* Capture already succeeded. */ }
        });
        add_action('wconvert_lead_captured', function (\WConvert\Lead\Lead $lead): void { $this->remember($lead->optinId, true); });
        add_action('woocommerce_privacy_remove_order_personal_data', static function (\WC_Order $order): void {
            $order->delete_meta_data(Attribution::META);
            $order->save();
        });
        add_action('woocommerce_checkout_order_created', [$this, 'bindOrder']);
        add_action('woocommerce_store_api_checkout_order_processed', [$this, 'bindOrder']);
        add_action('wconvert_attribution_claim_expired', static function (string $key): void {
            if (preg_match('/^wconvert_order_claim_[a-f0-9]{64}$/D', $key)) delete_option($key);
        });
        add_filter('wconvert_privacy_browser_storage', function (array $rows): array {
            if ($this->settings()['since'] === null) return $rows;
            $rows['additional'][] = __('When enabled and statistics consent is granted, campaign sales tracking stores a campaign reference and interaction time in the WooCommerce session. An interaction can link one checkout created within 30 minutes. A short-lived anonymous receipt prevents duplicate credit. Order attribution stays with the order under WooCommerce retention and erasure policies; no contact details or money are copied into WConvert.', 'wconvert');
            return $rows;
        });
    }

    /** @return array{enabled: bool, since: ?string, home: string} */
    public function settings(): array
    {
        $value = $this->options->get(self::OPTION, []);
        return ['enabled' => is_array($value) && ($value['enabled'] ?? false) === true,
            'since' => is_array($value) && is_string($value['since'] ?? null) ? $value['since'] : null,
            'home' => is_array($value) && is_string($value['home'] ?? null) ? $value['home'] : ''];
    }

    private function active(): bool
    {
        $value = $this->settings();
        return function_exists('WC') && $value['enabled'] && $value['home'] === home_url('/') && !Routes::canManage() && !is_preview();
    }

    public function routes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/revenue', [
            ['methods' => 'GET', 'callback' => [$this, 'report'], 'permission_callback' => [Routes::class, 'canManage'], 'args' => \WConvert\Rest\ReportWindow::args(true) + ['optin_id' => ['type' => 'string', 'pattern' => '^[A-Z0-9]{26}$']]],
            ['methods' => 'POST', 'callback' => [$this, 'save'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
    }

    public function save(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $body = $request->get_json_params();
        if (!function_exists('WC') || !is_array($body) || !is_bool($body['enabled'] ?? null) || count($body) !== 1) return new WP_Error('wconvert_revenue_settings', __('Choose whether to track campaign sales on this WooCommerce site.', 'wconvert'), ['status' => 422]);
        $prior = $this->settings();
        $this->options->set(self::OPTION, ['enabled' => $body['enabled'], 'since' => $prior['home'] === home_url('/') ? ($prior['since'] ?? ($body['enabled'] ? gmdate('c') : null)) : ($body['enabled'] ? gmdate('c') : null), 'home' => home_url('/')]);
        PageCache::purge();
        return new WP_REST_Response(['settings' => $this->settings()]);
    }

    public function report(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $settings = $this->settings();
        $base = ['guide_url' => WCONVERT_PRO_URL . 'docs/campaign-sales.html', 'available' => function_exists('wc_get_orders'), 'settings' => $settings, 'site_matches' => $settings['home'] === home_url('/'),
            'consent_ready' => function_exists('wp_has_consent') && in_array(apply_filters('wp_get_consent_type', false), ['optin', 'optout'], true)];
        if (!$base['available'] || $settings['since'] === null) return new WP_REST_Response($base);
        try { $range = \WConvert\Rest\ReportWindow::read($request); }
        catch (\InvalidArgumentException) { return new WP_Error('wconvert_report_range', __('Choose a current or earlier month.', 'wconvert'), ['status' => 400]); }
        return new WP_REST_Response($base + (new RevenueReport())->read($range, (string) ($request->get_param('optin_id') ?? '')));
    }

    public function enqueue(): void
    {
        if (!$this->active() || is_admin() || is_feed() || is_embed() || isset($_GET['wconvert-analytics'])) return;
        $path = WCONVERT_PRO_DIR . 'modules/analytics/public/revenue.js';
        if (!is_file($path)) return;
        $config = ['endpoint' => \WC_AJAX::get_endpoint('wconvert_interaction'), 'campaigns' => Metadata::forEntries($this->entries, $this->published->all())];
        add_action('wp_head', static function () use ($config): void {
            echo '<script type="application/json" id="wconvert-revenue-config">' . wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }, 6);
        wp_enqueue_script(self::HANDLE, WCONVERT_PRO_URL . 'modules/analytics/public/revenue.js', [], BuiltAsset::version($path), true);
    }

    public function interaction(): void
    {
        nocache_headers();
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $expected = wp_parse_url(home_url('/'));
        $actual = is_string($origin) ? wp_parse_url($origin) : false;
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !is_array($actual) || !is_array($expected)
            || ($actual['scheme'] ?? '') !== ($expected['scheme'] ?? '') || ($actual['host'] ?? '') !== ($expected['host'] ?? '') || ($actual['port'] ?? null) !== ($expected['port'] ?? null)) wp_send_json_error(null, 403);
        if (($_POST['clear'] ?? '') === '1') {
            if (function_exists('WC') && WC()->session) WC()->session->__unset(Attribution::KEY);
            wp_send_json_success();
        }
        $id = is_string($_POST['id'] ?? null) ? $_POST['id'] : '';
        if (!$this->active() || !Attribution::consent() || !$this->limit->allows('revenue:' . (string) ($_SERVER['REMOTE_ADDR'] ?? ''), time())) wp_send_json_error(null, 403);
        $event = is_string($_POST['event'] ?? null) ? $_POST['event'] : '';
        $at = is_string($_POST['at'] ?? null) && ctype_digit($_POST['at']) ? (int) $_POST['at'] : 0;
        if (!Attribution::clickToken($event, $at, time())) wp_send_json_error(null, 422);
        if (!$this->remember($id, false, $event)) wp_send_json_error(null, 422);
        wp_send_json_success();
    }

    private function remember(string $id, bool $capture, ?string $event = null, bool $addition = false): bool
    {
        try {
            if (!$this->active() || !Attribution::consent()) return false;
            $set = $this->published->all();
            if (!isset(\WConvert\Optin\PublishedOptin::servableIdsIn($set, $this->degradation)[$id])) return false;
            $entry = array_column($set, null, 'id')[$id] ?? null;
            if (!is_array($entry)) return false;
            $metadata = Metadata::forEntries([['id' => $id] + $entry['payload']], $set)[$id] ?? null;
            if ($metadata === null || ($metadata['outcome'] === 'addition' && !$addition) || (!$capture && $metadata['outcome'] === 'capture')) return false;
            if ($event !== null) {
                // Claim the browser event once, including concurrent/replayed requests. Its
                // timestamp expires before cleanup, so an old exact request cannot reopen credit.
                $claim = 'wconvert_order_claim_' . hash('sha256', 'click:' . $event);
                if (!add_option($claim, time(), '', false)) return false;
                wp_schedule_single_event(time() + Attribution::WINDOW, 'wconvert_attribution_claim_expired', [$claim]);
            }
            if (!WC()->session) wc_load_cart();
            if (!WC()->session) return false;
            WC()->session->set_customer_session_cookie(true);
            WC()->session->set(Attribution::KEY, ['version' => 1, 'arm' => $id, 'family' => $metadata['campaign'], 'at' => time(), 'receipt' => bin2hex(random_bytes(16))]);
            WC()->session->save_data();
            return true;
        } catch (\Throwable) { return false; }
    }

    public function bindOrder(\WC_Order $order): void
    {
        try {
            if (!$this->active() || !WC()->session || !$order->get_id() || $order->get_meta(Attribution::META)) return;
            $value = WC()->session->get(Attribution::KEY);
            WC()->session->__unset(Attribution::KEY);
            WC()->session->save_data();
            if (!Attribution::consent() || !is_array($value) || !Attribution::eligible($value, time())) return;
            $created = $order->get_date_created()?->getTimestamp();
            if ($created === null || $created < $value['at'] || $created >= $value['at'] + Attribution::WINDOW) return;
            // A unique short-lived option is an atomic receipt claim, including concurrent checkout requests.
            $claim = 'wconvert_order_claim_' . hash('sha256', $value['receipt']);
            if (!add_option($claim, $order->get_id(), '', false)) return;
            wp_schedule_single_event(time() + Attribution::WINDOW, 'wconvert_attribution_claim_expired', [$claim]);
            $order->update_meta_data(Attribution::META, array_diff_key($value, ['receipt' => true]));
            $order->save();
        } catch (\Throwable) {
            // Keep the consumed claim; reporting must never interrupt payment or duplicate credit.
        }
    }
}
