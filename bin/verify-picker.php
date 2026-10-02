<?php
/** Native WordPress check. Run only in an explicitly disposable database.
 * WCONVERT_VERIFY_BOOTSTRAP=/absolute/test-bootstrap.php php bin/verify-picker.php
 * Bootstrap must define WCONVERT_VERIFY_PICKER=true and load WConvert.
 * No publication, provider delivery or catalog network calls.
 */
declare(strict_types=1);

use WConvert\Bootstrap;
use WConvert\Discovery\PickerDocuments;
use WConvert\Optin\OptinRepository;
use WConvert\Rest\PickerController;

$bootstrap = getenv('WCONVERT_VERIFY_BOOTSTRAP');
if (!defined('ABSPATH') && is_string($bootstrap) && is_file($bootstrap)) require $bootstrap;
if (!defined('WCONVERT_VERIFY_PICKER') || WCONVERT_VERIFY_PICKER !== true) throw new RuntimeException('An explicitly disposable WordPress bootstrap is required.');

function pickerCheck(bool $okay, string $message): void {
    if (!$okay) throw new RuntimeException($message);
    echo "PASS $message\n";
}
/** @param array<string, mixed> $params */
function pickerRequest(string $method, string $path, array $params = []): WP_REST_Response {
    $request = new WP_REST_Request($method, '/wconvert/v1/' . $path);
    foreach ($params as $key => $value) $request->set_param($key, $value);
    return rest_do_request($request);
}

$originalUser = get_current_user_id();
$user = wp_insert_user(['user_login' => 'picker-review-' . wp_generate_password(8, false), 'user_pass' => wp_generate_password(24), 'role' => 'administrator']);
if ($user instanceof WP_Error) throw new RuntimeException($user->get_error_message());
$occasionBefore = get_option(PickerDocuments::OCCASIONS, null);
$repo = Bootstrap::container()->resolve(OptinRepository::class);
$campaignsBefore = wp_json_encode($repo->summaries());
try {
    wp_set_current_user(0);
    pickerCheck(pickerRequest('GET', 'picker')->get_status() === 401, 'Anonymous users cannot read picker planning data');
    wp_set_current_user($user);
    $picker = pickerRequest('GET', 'picker')->get_data();
    pickerCheck($picker['preferences']['saved'] === [], 'New administrator has independent favorites');
    $prefs = $picker['preferences']; $prefs['saved'] = ['registered:reading-desk'];
    pickerCheck(pickerRequest('PUT', 'picker/preferences', ['revision' => 0, 'data' => $prefs])->get_status() === 200, 'Favorite persists through the authenticated WordPress route');
    pickerCheck(pickerRequest('GET', 'picker')->get_data()['preferences']['saved'] === $prefs['saved'], 'Favorite survives the next server read');
    pickerCheck(pickerRequest('PUT', 'picker/preferences', ['revision' => 0, 'data' => $prefs])->get_status() === 409, 'Stale preference writer receives a conflict');
    add_option('wconvert_picker_lock_user_' . $user, ['at' => time(), 'token' => 'other-writer'], '', false);
    pickerCheck(pickerRequest('PUT', 'picker/preferences', ['revision' => 1, 'data' => $prefs])->get_status() === 409, 'Concurrent writer cannot enter an active lease');
    delete_option('wconvert_picker_lock_user_' . $user);
    $prefs['saved'] = array_fill(0, 201, 'registered:reading-desk');
    pickerCheck(pickerRequest('PUT', 'picker/preferences', ['revision' => 1, 'data' => $prefs])->get_status() === 400, 'Oversized preferences are rejected without changing the saved document');
    $revision = $picker['occasions']['revision'];
    $occasion = ['id' => 'review-sale', 'name' => 'Test anniversary', 'start' => '2026-11-27', 'end' => '2026-11-30', 'campaign_id' => 'ignored', 'publish' => true];
    $saved = pickerRequest('PUT', 'picker/occasions', ['revision' => $revision, 'data' => ['items' => [$occasion]]]);
    pickerCheck($saved->get_status() === 200 && count($saved->get_data()['items'][0]) === 4, 'Site occasions save calendar dates and discard campaign commands');
    pickerCheck(pickerRequest('PUT', 'picker/occasions', ['revision' => $revision, 'data' => ['items' => []]])->get_status() === 409, 'Shared site occasions reject a stale window');
    $occasion['end'] = '2026-02-30';
    pickerCheck(pickerRequest('PUT', 'picker/occasions', ['revision' => $revision + 1, 'data' => ['items' => [$occasion]]])->get_status() === 400, 'Impossible occasion dates do not overwrite the previous document');
    wp_set_current_user($originalUser);
    pickerCheck(pickerRequest('GET', 'picker')->get_data()['preferences']['saved'] !== ['registered:reading-desk'], 'Favorites remain private to their user');
    wp_set_current_user($user);
    $sourceJson = file_get_contents(WCONVERT_DIR . 'tools/design-library/collections/source.json');
    if ($sourceJson === false) throw new RuntimeException('Missing reviewed collection source');
    $source = json_decode($sourceJson, true, 64, JSON_THROW_ON_ERROR);
    $ids = array_unique(array_column(array_merge(...array_column($source['collections'], 'items')), 'setup_id'));
    $books = Bootstrap::container()->resolve(\WConvert\Playbook\PlaybookLibrary::class);
    foreach ($ids as $id) {
        $book = $books->find($id); pickerCheck($book !== null, "Collection setup exists: $id");
        $goal = $book->goal->value;
        $index = pickerRequest('GET', 'playbooks', ['goal' => $goal]);
        $entry = current(array_filter($index->get_data(), static fn ($row) => $row['id'] === $id));
        pickerCheck($entry && !isset($entry['template']) && !isset($entry['copy']), "Discovery is metadata only: $id");
        $preview = pickerRequest('GET', 'playbooks/previews', ['goal' => $goal, 'ids' => $id])->get_data()['entries'][0] ?? null;
        pickerCheck(isset($preview['template']['tree']['steps'], $preview['prepared_revision']), "Actual prepared screens available: $id");
        $draft = pickerRequest('GET', 'playbooks/prefill', ['goal' => $goal, 'playbook_id' => $id, 'revision' => $entry['revision'], 'prepared_revision' => $preview['prepared_revision']]);
        pickerCheck($draft->get_status() === 200 && $draft->get_data()['config']['template'] === $preview['template'], "Draft matches the inspected design: $id");
        $config = $draft->get_data()['config'];
        pickerCheck(\WConvert\Template\CaptureContract::issue($config, $goal, get_privacy_policy_url()) === null, "Prepared journey contract is valid: $id");
        $tree = $preview['template']['tree'];
        foreach ($tree['submissions'] as $submission) {
            $fields = []; $consent = false;
            foreach ($tree['steps'] as $screen) foreach (\WConvert\Template\CaptureJourney::nodes($screen['content']) as $node) {
                if (in_array($node['id'] ?? null, $submission['consents'], true) && !($node['hidden'] ?? false)) $consent = true;
                if (!in_array($node['id'] ?? null, $submission['fields'], true)) continue;
                $value = match ($node['name'] ?? '') {
                    'email' => 'picker-review@example.test', 'phone' => '+12025551234', 'name' => 'Review example',
                    'interest' => $node['options'][0]['value'] ?? '', default => 'Test request',
                };
                $fields[$node['name']] = $value;
            }
            $form = \WConvert\Lead\CaptureForm::fromTemplate($preview['template'], Bootstrap::container()->resolve(\WConvert\Template\TemplateVocabulary::class), $submission['id']);
            pickerCheck($form->validate(['fields' => $fields, 'consent' => true]) instanceof \WConvert\Lead\Submission, "Declared fields accept a practical example: $id");
            $bad = $fields; if (isset($bad['email'])) $bad['email'] = 'invalid'; else $bad['phone'] = 'invalid';
            pickerCheck($form->validate(['fields' => $bad, 'consent' => true]) instanceof \WConvert\Lead\Refusal, "Invalid identifier is refused before saving: $id");
            if ($consent) pickerCheck($form->validate(['fields' => $fields, 'consent' => false]) instanceof \WConvert\Lead\Refusal, "Unchecked displayed consent is refused: $id");
            if (isset($fields['interest'])) { $fields['interest'] = 'unknown-choice'; pickerCheck($form->validate(['fields' => $fields, 'consent' => true]) instanceof \WConvert\Lead\Refusal, "Unknown service choice is refused: $id"); }
        }

        pickerCheck(pickerRequest('GET', 'playbooks/prefill', ['goal' => $goal, 'playbook_id' => $id, 'prepared_revision' => str_repeat('0', 64)])->get_status() === 409, "Changed prepared design is refused: $id");
    }
    $goal = $books->find('sunday-reading')->goal->value;
    pickerCheck(pickerRequest('GET', 'playbooks/previews', ['goal' => $goal, 'ids' => implode(',', array_map(static fn ($n) => 'id-' . $n, range(1, 25)))])->get_status() === 400, 'Preview batches are bounded at 24');
    pickerCheck(wp_json_encode($repo->summaries()) === $campaignsBefore, 'Discovery, favorite saves and occasion edits never create or publish a campaign');
    echo 'WordPress ' . get_bloginfo('version') . ' / PHP ' . PHP_VERSION . "\n";
} finally {
    if ($occasionBefore === null) delete_option(PickerDocuments::OCCASIONS); else update_option(PickerDocuments::OCCASIONS, $occasionBefore, false);
    wp_set_current_user($originalUser);
    require_once ABSPATH . 'wp-admin/includes/user.php';
    wp_delete_user($user);
    delete_option('wconvert_picker_lock_user_' . $user);
}
