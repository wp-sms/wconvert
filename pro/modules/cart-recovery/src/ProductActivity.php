<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Rest\RateLimit;
use WConvert\Stats\{BeaconTraffic, StatDay, StatKind, StatsRepository};

defined('ABSPATH') || exit;

/** Browser observations require a recently served card; additions remain server-only. */
final class ProductActivity
{
    public function __construct(private readonly PublishedSet $published, private readonly Degradation $degradation,
        private readonly RateLimit $limit, private readonly StatsRepository $stats) {}

    public function hooks(): void
    {
        add_action('wc_ajax_wconvert_product_activity', [$this, 'serve']);
        add_filter('wconvert_product_activity_campaign', function (bool $available, string $id): bool {
            foreach ($this->published->all() as $entry) {
                if ($entry['id'] === $id && CommerceContext::products($entry['payload']) !== null) return true;
            }
            return $available;
        }, 10, 2);
        add_filter('wconvert_product_activity_name', static function (string $name, int $id): string {
            $product = wc_get_product($id);
            return $product ? $product->get_name() : $name;
        }, 10, 2);
    }

    public function serve(): void
    {
        nocache_headers(); header('Cache-Control: private, no-store, max-age=0');
        $source = wp_parse_url((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
        $site = wp_parse_url(home_url());
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !is_array($source) || !is_array($site)
            || ($source['scheme'] ?? '') !== ($site['scheme'] ?? '') || ($source['host'] ?? '') !== ($site['host'] ?? '')
            || ($source['port'] ?? null) !== ($site['port'] ?? null)
            || (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin')) wp_send_json(null, 403);
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024 || strlen((string) wp_json_encode($_POST)) > 1024) wp_send_json(null, 413);
        if (!BeaconTraffic::countable((string) ($_SERVER['HTTP_SEC_PURPOSE'] ?? ''), (string) ($_SERVER['HTTP_PURPOSE'] ?? ''), (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''))) wp_send_json(null, 204);
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ip === '' || !$this->limit->allows('product-activity:' . $ip, time())) wp_send_json(null, 429);
        $id = self::field('id'); $product = self::field('product'); $kind = self::field('kind');
        if (!preg_match('/^[1-9][0-9]{0,9}$/D', $product) || !in_array($kind, ['product_shown', 'product_click'], true)) wp_send_json(null, 204);
        foreach ($this->published->all() as $entry) {
            if ($entry['id'] !== $id) continue;
            $payload = $entry['payload'];
            if ($this->degradation->suspendedIn($payload) !== null || CommerceContext::products($payload) === null
                || !ProductActivityToken::valid(self::field('token'), $id, CommerceContext::revision($payload), (int) $product, time(), wp_salt('nonce'))) break;
            $this->stats->increment($id, StatKind::from($kind), StatDay::today(), 'product:' . $product);
            break;
        }
        wp_send_json(null, 204);
    }
    private static function field(string $key): string
    {
        return is_string($_POST[$key] ?? null) ? wp_unslash($_POST[$key]) : '';
    }
}
