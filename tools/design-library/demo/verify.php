<?php
/** Run with `wp eval-file` against ONLY the disposable MySQL demo. */
if (!defined('WCONVERT_LIBRARY_DEMO') || WCONVERT_LIBRARY_DEMO !== true) throw new RuntimeException('Disposable demo required');
global $wpdb;
if (!str_contains(DB_NAME, 'wconvert_library_demo')) throw new RuntimeException('Demo database required');
wp_set_current_user(1);
$container = \WConvert\Bootstrap::container();
$repo = $container->get(\WConvert\Optin\OptinRepository::class);
$leads = $container->get(\WConvert\Lead\LeadRepository::class);
$report = [];
$runId = bin2hex(random_bytes(6));
$resourceRecipients = [];
function demo_assert(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function demo_destination_id(string $url): int {
    $id = url_to_postid($url);
    if ($id) return $id;
    // WooCommerce plain product permalinks use ?product=slug, which url_to_postid does not resolve.
    parse_str((string) wp_parse_url($url, PHP_URL_QUERY), $query);
    return isset($query['product']) ? (int) (get_page_by_path($query['product'], OBJECT, 'product')?->ID ?? 0) : 0;
}
function demo_capture(array $body): WP_REST_Response {
    $request = new WP_REST_Request('POST', '/wconvert/v1/capture');
    $request->set_header('Content-Type', 'application/json');
    $request->set_body(wp_json_encode($body));
    return rest_do_request($request);
}
$campaigns = get_option('wconvert_demo_campaigns', []);
$briefs = json_decode(file_get_contents(WP_CONTENT_DIR . '/plugins/wconvert/tools/design-library/pilot/collection.json'), true, 512, JSON_THROW_ON_ERROR)['entries'];
foreach ($briefs as $brief) demo_assert(isset($campaigns[$brief['id']]), 'Demo not seeded: ' . $brief['id']);
foreach ($campaigns as $key => $entry) {
    try {
        $optin = $repo->find($entry['id']);
        demo_assert($optin !== null && $optin->publishedConfig !== null, 'Missing published campaign');
        $config = $optin->publishedConfig;
        $tree = $config['template']['tree'];
        $contract = \WConvert\Template\CaptureContract::fingerprint($config, $optin->goal, get_privacy_policy_url());
        $base = ['optin_id' => $optin->id, 'contract' => $contract];
        $before = $leads->submissions($optin->id);
        $checks = ['published'];
        $questions = [];
        foreach ($tree['steps'] as $step) foreach (\WConvert\Template\CaptureJourney::nodes($step['content']) as $node) {
            if (($node['type'] ?? '') === 'question') $questions[$node['id']] = ($node['answer_type'] ?? '') === 'multi' ? [$node['options'][0]['value']] : ($node['options'][0]['value'] ?? 'Example project');
            if (($node['type'] ?? '') === 'followup' && !($node['hidden'] ?? false)) {
                demo_assert(demo_destination_id($node['href'] ?? '') > 0, 'Visible follow-up has no resource page');
                $checks[] = 'visible acknowledgement resource link';
            }
            if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'link' && $optin->goal !== 'recover_cart') {
                demo_assert(url_to_postid($node['href'] ?? '') > 0, 'Link does not resolve to a real sample page');
                $checks[] = 'real link destination';
            }
        }
        $leadId = null;
        if (!empty($tree['submissions'])) {
            $start = demo_capture($base + ['phase' => 'start']);
            demo_assert($start->get_status() === 200, 'Session start: ' . wp_json_encode($start->get_data()));
            $base['grant'] = $start->get_data()['grant'];
            foreach ($tree['submissions'] as $submission) {
                $fields = [];
                foreach ($tree['steps'] as $step) foreach (\WConvert\Template\CaptureJourney::nodes($step['content']) as $node) {
                    if (($node['type'] ?? '') !== 'field' || !in_array($node['id'], $submission['fields'], true)) continue;
                    $fields[$node['name']] = match ($node['name']) {
                        'email' => 'review-' . $runId . '-' . $key . '@example.test', 'phone' => '+12025550123',
                        'name' => 'Demo visitor', 'interest' => $node['options'][0]['value'] ?? '', default => '',
                    };
                }
                $body = $base + ['submission' => $submission['id'], 'fields' => $fields, 'consent' => true, 'question_answers' => $questions];
                $invalid = $body; $invalid['fields'] = [];
                demo_assert(demo_capture($invalid)->get_status() === 422, 'Empty required fields must be refused');
                $response = demo_capture($body);
                demo_assert($response->get_status() === 201, 'Capture: ' . wp_json_encode($response->get_data()));
                $accepted = $response->get_data();
                if ($leadId !== null) demo_assert($leadId === $accepted['id'], 'Optional channel created a second lead');
                $leadId = $accepted['id'];
                $replay = demo_capture($body);
                demo_assert($replay->get_status() === 200 && $replay->get_data()['replay'] === true, 'Retry was not idempotent');
                $stored = $leads->find($leadId);
                demo_assert($stored !== null, 'Missing saved lead');
                if (isset($fields['phone'])) demo_assert($stored->phone === '+12025550123', 'Phone is not canonical');
                if (isset($fields['email'])) demo_assert($stored->email === $fields['email'], 'Email missing');
                if ($optin->goal === 'deliver_lead_magnet' && isset($fields['email'])) $resourceRecipients[$key] = $fields['email'];
                if (isset($fields['interest'])) demo_assert(($stored->fields['interest'] ?? '') === $fields['interest'], 'Selected preference missing');
                $checks[] = $submission['id'] . ': required fields, capture, retry, saved values';
            }
            demo_assert($leads->submissions($optin->id) === $before + 1, 'Journey must create exactly one lead');
        }
        foreach ($tree['steps'] as $step) foreach ($step['results'] ?? [] as $result) {
            demo_assert(demo_destination_id($result['href'] ?? '') > 0, 'Result destination missing: ' . $result['id']);
            if ($key === 'gift-finder' && $result['id'] !== 'fallback') {
                $price = (float) wc_get_product($result['product_ids'][0])->get_price();
                $small = str_ends_with($result['id'], '_small');
                demo_assert($small ? $price <= 30 : ($price >= 30 && $price <= 60), 'Gift recommendation exceeds selected budget');
                $checks[] = 'gift price matches selected budget';
            }
            foreach ($result['product_ids'] ?? [] as $productId) demo_assert(wc_get_product($productId)?->is_visible() === true, 'Product is unavailable');
            $checks[] = 'result ' . $result['id'] . ': destination and products';
        }
        $report[$key] = ['status' => 'passed', 'checks' => $checks];
    } catch (Throwable $error) { $report[$key] = ['status' => 'failed', 'error' => $error->getMessage()]; }
}
ActionScheduler_QueueRunner::instance()->run();
// The outbox is capped at 100. Unique run recipients distinguish new mail even at capacity.
$newMail = get_option('wconvert_demo_outbox', []);
foreach ($resourceRecipients as $key => $recipient) {
    $mail = array_values(array_filter($newMail, static fn ($mail) => in_array($recipient, (array) $mail['to'], true)));
    try {
        demo_assert(count($mail) === 1, 'Resource must hand off one email per new Lead');
        preg_match('~https?://[^\s<>"\']+~', $mail[0]['message'], $link);
        $resourceId = url_to_postid(html_entity_decode($link[0] ?? ''));
        demo_assert($resourceId > 0 && str_contains((string) get_post_field('post_content', $resourceId), '<h2>'), 'Resource email must link to the promised content');
        $report[$key]['checks'][] = 'one local resource email with an accessible content page';
    } catch (Throwable $error) { $report[$key] = ['status' => 'failed', 'error' => $error->getMessage()]; }
}
$report['_outbox'] = ['messages' => count(get_option('wconvert_demo_outbox', [])), 'scope' => 'Local wp_mail handoff only; no external inbox delivery'];
file_put_contents(WP_CONTENT_DIR . '/plugins/wconvert/tools/design-library/out/demo-verification.json', wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
if (array_filter($report, static fn ($row) => ($row['status'] ?? '') === 'failed')) throw new RuntimeException('Practical checks failed');
