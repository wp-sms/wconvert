<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Rest\{ProductMatchesController, RateLimit};
use WConvert\Stats\ProductStats;

defined('ABSPATH') || exit;

/** Public result cards, resolved from the published design, never visitor-supplied IDs. */
final class QuizProducts
{
    public function __construct(private readonly PublishedSet $published, private readonly Degradation $degradation, private readonly RateLimit $limit) {}

    public function hooks(): void { add_action('wc_ajax_wconvert_quiz_products', [$this, 'serve']); }

    /** @param array<string, mixed> $payload */
    public static function used(array $payload): bool
    {
        foreach ($payload['template']['tree']['steps'] ?? [] as $screen) foreach ($screen['results'] ?? [] as $result) {
            if (!empty($result['product_ids']) || isset($result['product_filter'])) return true;
        }
        return false;
    }

    /** @param array<string, mixed> $payload
     * @return array<string, mixed>|null */
    public static function result(array $payload, string $screenId, string $resultId): ?array
    {
        $matches = [];
        foreach ($payload['template']['tree']['steps'] ?? [] as $screen) {
            if (($screen['kind'] ?? '') !== 'result' || ($screen['id'] ?? '') !== $screenId) continue;
            foreach ($screen['results'] ?? [] as $result) if (($result['id'] ?? '') === $resultId) $matches[] = $result;
        }
        return count($matches) === 1 ? $matches[0] : null;
    }

    /** Catalog reads and mutation rechecks share the same bounded selection.
     * @param array<string, mixed> $result
     * @return list<array<string, mixed>>|\WP_Error */
    public static function cards(array $result): array|\WP_Error
    {
        $ids = array_slice($result['product_ids'] ?? [], 0, 6);
        if (isset($result['product_filter'])) {
            $request = new \WP_REST_Request('GET');
            $request->set_param('filter', wp_json_encode($result['product_filter']));
            $response = (new ProductMatchesController())->matches($request);
            if ($response instanceof \WP_Error) return $response;
            $ids = array_column($response->get_data(), 'id');
        }
        $cards = [];
        foreach (array_unique($ids) as $id) {
            $product = wc_get_product($id);
            if (!$product) continue;
            $card = CommerceContext::card($product, ($result['product_action'] ?? 'link') === 'add_to_cart');
            if ($card) $cards[] = $card;
            if (count($cards) === 3) break;
        }
        return $cards;
    }

    public function serve(): void
    {
        nocache_headers(); header('Cache-Control: private, no-store, max-age=0');
        $source = wp_parse_url((string) ($_SERVER['HTTP_ORIGIN'] ?? '')); $site = wp_parse_url(home_url());
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !is_array($source) || !is_array($site)
            || ($source['scheme'] ?? '') !== ($site['scheme'] ?? '') || ($source['host'] ?? '') !== ($site['host'] ?? '')
            || ($source['port'] ?? null) !== ($site['port'] ?? null)
            || (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin')) wp_send_json(null, 403);
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024 || strlen((string) wp_json_encode($_POST)) > 1024) wp_send_json(null, 413);
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ip === '' || !$this->limit->allows('quiz-products:' . $ip, time())) wp_send_json(null, 429);
        foreach ($this->published->all() as $entry) {
            if ($entry['id'] !== self::field('id')) continue;
            $payload = $entry['payload']; $revision = CommerceContext::revision($payload);
            if ($this->degradation->suspendedIn($payload) !== null || !hash_equals($revision, self::field('revision'))) break;
            $result = self::result($payload, self::field('screen'), self::field('result'));
            if ($result === null) break;
            $cards = self::cards($result);
            if ($cards instanceof \WP_Error) wp_send_json(null, 503);
            foreach ($cards as &$card) $card['activity_token'] = ProductActivityToken::issue($entry['id'], $revision, $card['id'], time(), wp_salt('nonce'));
            unset($card);
            ProductStats::start($entry['id']);
            wp_send_json($cards);
        }
        wp_send_json(null, 409);
    }

    private static function field(string $key): string { return is_string($_POST[$key] ?? null) ? wp_unslash($_POST[$key]) : ''; }
}
