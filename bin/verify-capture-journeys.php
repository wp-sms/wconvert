<?php
/** Real WordPress/MySQL journey verification. Use an isolated WordPress database.
 * WCONVERT_VERIFY_BOOTSTRAP=/absolute/path/to/test-wp-bootstrap.php php bin/verify-capture-journeys.php
 * The bootstrap must define WCONVERT_VERIFY_JOURNEYS=true and load WConvert.
 * No external providers are contacted. Composer's development fixtures are required.
 */
declare(strict_types=1);

use WConvert\Bootstrap;
use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\PushJob;
use WConvert\Destination\PushWorker;
use WConvert\Destination\SubmissionDispatcher;
use WConvert\Lead\JourneyCapture;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PhoneCountry;
use WConvert\Queue\ActionSchedulerQueue;
use WConvert\Queue\Queue;
use WConvert\Rest\CaptureController;
use WConvert\Template\CaptureContract;
use WConvert\Tests\Unit\Support\FakeDestinationType;

$bootstrap = getenv('WCONVERT_VERIFY_BOOTSTRAP');
if (!defined('ABSPATH') && is_string($bootstrap) && is_file($bootstrap)) { require $bootstrap; }
if (!defined('WCONVERT_VERIFY_JOURNEYS') || WCONVERT_VERIFY_JOURNEYS !== true) {
    fwrite(STDERR, "This check requires an explicitly isolated WordPress bootstrap.\n"); exit(2);
}

/** @param array<string, mixed> $body
 * @return array<string, mixed>
 */
function journeyRequest(array $body): array
{
    $request = new WP_REST_Request('POST', '/wconvert/v1/capture');
    $request->set_header('Content-Type', 'application/json');
    $request->set_body((string) wp_json_encode($body));
    $result = Bootstrap::container()->resolve(CaptureController::class)->capture($request);
    if ($result instanceof WP_Error) { return ['error' => $result->get_error_code()]; }
    return $result->get_data();
}
function journeyCheck(bool $condition, string $message): void
{
    if (!$condition) { throw new RuntimeException($message); }
    echo "PASS {$message}\n";
}

if (($argv[1] ?? '') === 'worker') {
    $body = json_decode((string) stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
    echo wp_json_encode(journeyRequest($body)); exit;
}

$c = Bootstrap::container();
$c->resolve(Installer::class)->install();
$db = $c->resolve(Connection::class);
$optins = $c->resolve(OptinRepository::class);
$leads = $c->resolve(LeadRepository::class);
$destinations = $c->resolve(DestinationStore::class);
$provider = new FakeDestinationType('journey-verification');
$c->resolve(DestinationRegistry::class)->register($provider);
$emailRoute = $destinations->save(null, $provider->id(), 'Verification email', null, []);
$smsRoute = $destinations->save(null, $provider->id(), 'Verification SMS', null, []);
$template = json_decode((string) file_get_contents(dirname(__DIR__) . '/resources/templates/library/journey-email-then-sms.json'), true, 32, JSON_THROW_ON_ERROR);
$resolvedTemplate = PhoneCountry::resolved(['template' => $template], 'US');
if ($resolvedTemplate === null) throw new RuntimeException('Journey verification needs a valid phone starting country');
$template = $resolvedTemplate['template'];
$config = ['template' => $template, 'display_type' => 'popup', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(),
    'destinations' => [$emailRoute->id], 'submission_settings' => ['sms-signup' => ['destination_ids' => [$smsRoute->id]]]];
$optin = $optins->create('Journey verification', 'grow_email_list', $config);
$optins->publish($optin->id);
$base = ['optin_id' => $optin->id, 'contract' => CaptureContract::fingerprint($config, $optin->goal, get_privacy_policy_url())];
$grant = journeyRequest($base + ['phase' => 'start'])['grant'];
$email = 'journey-' . strtolower($optin->id) . '@example.test';
$body = $base + ['grant' => $grant, 'submission' => 'email-signup', 'fields' => ['email' => $email], 'consent' => true];
$first = journeyRequest($body);
$again = journeyRequest($body);
journeyCheck(isset($first['id']) && $first['id'] === ($again['id'] ?? null) && $again['replay'], 'a repeated first request returns the same Lead');
$smsBody = $base + ['grant' => $grant, 'submission' => 'sms-signup', 'fields' => ['phone' => '+12025551234'], 'consent' => true];
$withoutConsent = $smsBody; $withoutConsent['consent'] = false;
journeyCheck(isset(journeyRequest($withoutConsent)['error']) && $leads->find($first['id'])?->phone === null, 'SMS without its own consent leaves the saved email intact');
$invalidPhone = $smsBody; $invalidPhone['fields'] = ['phone' => 'not-a-phone'];
journeyCheck(isset(journeyRequest($invalidPhone)['error']) && $leads->find($first['id'])?->phone === null, 'an invalid phone cannot partially update the Lead');
$stale = $smsBody; $stale['contract'] = str_repeat('0', 64);
journeyCheck((journeyRequest($stale)['error'] ?? '') === 'wconvert_capture_changed', 'a stale page contract cannot add another signup');
$expired = $smsBody; $expired['grant'] = (new \WConvert\Lead\CaptureGrant(wp_salt('auth')))->issue($optin->id, $base['contract'], time() - 1801);
journeyCheck((journeyRequest($expired)['error'] ?? '') === 'wconvert_capture_expired', 'an expired grant cannot resume the journey');
$second = journeyRequest($smsBody);
journeyCheck(($second['id'] ?? null) === $first['id'], 'optional SMS adds to the same Lead');
$lead = $leads->find($first['id']);
journeyCheck($lead !== null && $lead->email === $email && $lead->phone === '+12025551234', 'the combined Lead holds both identifiers');
journeyCheck($lead?->submission('email-signup')?->phone === null && $lead?->submission('sms-signup')?->email === null, 'delivery payloads stay separate after the second signup');
journeyCheck($lead?->submission('email-signup')?->fields['consent_text'] !== $lead?->submission('sms-signup')?->fields['consent_text'], 'each signup keeps its own exact consent wording');
foreach (['email-signup' => $emailRoute->id, 'sms-signup' => $smsRoute->id] as $submission => $route) {
    $job = new PushJob($first['id'], $route, 1, $submission);
    journeyCheck(as_has_scheduled_action(PushJob::HOOK, [$job->toArgs()], ActionSchedulerQueue::GROUP), "{$submission} is queued immediately");
    $c->resolve(PushWorker::class)->run($job->toArgs());
    as_unschedule_all_actions(PushJob::HOOK, [$job->toArgs()], ActionSchedulerQueue::GROUP);
}
journeyCheck(count($provider->pushed) === 2, 'each accepted signup has one independent provider handoff');
$rows = $db->results(Connection::TABLE_STATS, 'SELECT kind, scope, `count` FROM %i WHERE optin_id = %s', $optin->id);
$counts = [];
foreach ($rows as $row) { $counts[$row['kind'] . ':' . $row['scope']] = (int) $row['count']; }
ksort($counts);
journeyCheck($counts === [
    'capture:' => 2,
    'conversion:' => 1,
    'conversion:channel:email_marketing' => 1,
    'conversion:channel:sms_marketing' => 1,
], 'one Campaign Conversion, two captured submissions, and two channel counts');
journeyCheck(get_option('wconvert_flow_' . $optin->id . '_' . $base['contract'], null) !== null, 'publication saves the reporting screen definitions');
$changed = $body; $changed['fields'] = ['email' => 'replacement@example.test'];
journeyCheck((journeyRequest($changed)['error'] ?? '') === 'wconvert_capture_conflict', 'an accepted email cannot be changed');
$leads->eraseByEmail($email);
journeyCheck((journeyRequest($body)['error'] ?? '') === 'wconvert_capture_conflict'
    && (journeyRequest($smsBody)['error'] ?? '') === 'wconvert_capture_conflict', 'erasure prevents both request replay and continuation');

// Queue insertion and handoff completion share the MySQL transaction.
remove_all_actions(JourneyCapture::ACCEPTED);
$grant = journeyRequest($base + ['phase' => 'start'])['grant'];
$body['grant'] = $grant;
$pending = journeyRequest($body);
$queue = new class implements Queue {
    public function dispatch(string $hook, array $args): void {
        (new ActionSchedulerQueue())->dispatch($hook, $args);
        throw new RuntimeException('Simulated interruption after enqueue');
    }
    public function schedule(int $timestamp, string $hook, array $args): void { throw new LogicException('Not used'); }
};
$dispatcher = new SubmissionDispatcher($db, $queue, $destinations, $c->resolve(DestinationRegistry::class), $c->resolve(\WConvert\Destination\HealthStore::class));
try { $dispatcher->dispatch($pending['id'], 'email-signup'); } catch (RuntimeException) {}
$job = new PushJob($pending['id'], $emailRoute->id, 1, 'email-signup');
journeyCheck(!as_has_scheduled_action(PushJob::HOOK, [$job->toArgs()], ActionSchedulerQueue::GROUP), 'an interrupted queue transaction leaves no partial job');
journeyCheck(($leads->find($pending['id'])?->capture['submissions']['email-signup']['handoff'] ?? null) === 'pending', 'the saved signup remains recoverable after queue failure');
$dispatcher = new SubmissionDispatcher($db, new ActionSchedulerQueue(), $destinations, $c->resolve(DestinationRegistry::class), $c->resolve(\WConvert\Destination\HealthStore::class));
$dispatcher->dispatch($pending['id'], 'email-signup'); $dispatcher->dispatch($pending['id'], 'email-signup');
journeyCheck(as_has_scheduled_action(PushJob::HOOK, [$job->toArgs()], ActionSchedulerQueue::GROUP), 'recovery queues the frozen signup');
as_unschedule_all_actions(PushJob::HOOK, [$job->toArgs()], ActionSchedulerQueue::GROUP);
$leads->eraseByEmail($email);

// Independent PHP/WordPress connections exercise the unique receipt lock.
if (is_string($bootstrap) && is_file($bootstrap)) {
    $config['capture_mode'] = 'local';
    $race = $optins->create('Concurrent journey verification', 'grow_email_list', $config); $optins->publish($race->id);
    $raceBase = ['optin_id' => $race->id, 'contract' => CaptureContract::fingerprint($config, $race->goal, get_privacy_policy_url())];
    $raceBody = $raceBase + ['grant' => journeyRequest($raceBase + ['phase' => 'start'])['grant'], 'submission' => 'email-signup', 'fields' => ['email' => $email], 'consent' => true];
    $workers = [];
    for ($i = 0; $i < 6; $i++) {
        $process = proc_open([PHP_BINARY, __FILE__, 'worker'], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes);
        if (!is_resource($process)) { throw new RuntimeException('Could not start concurrent verification'); }
        fwrite($pipes[0], (string) wp_json_encode($raceBody)); fclose($pipes[0]);
        $workers[] = [$process, $pipes];
    }
    $ids = [];
    foreach ($workers as [$process, $pipes]) {
        $reply = json_decode((string) stream_get_contents($pipes[1]), true); fclose($pipes[1]);
        stream_get_contents($pipes[2]); fclose($pipes[2]);
        journeyCheck(proc_close($process) === 0 && isset($reply['id']), 'a concurrent worker completes without a storage error');
        $ids[] = $reply['id'];
    }
    journeyCheck(count(array_unique($ids)) === 1, 'six simultaneous requests create exactly one Lead');
    $leads->eraseByEmail($email); $optins->delete($race->id);
}
// Cross the 100-row recovery boundary using the real database and queue.
$bulkIds = [];
for ($i = 0; $i < 120; $i++) {
    $id = \WConvert\Support\Ulid::generate(); $bulkIds[] = $id;
    $data = ['answers' => [], 'capture' => ['submissions' => ['email-signup' => [
        'values' => ['email' => $email], 'destination_ids' => [$emailRoute->id], 'handoff' => 'pending',
    ]]]];
    $db->insert(Connection::TABLE_LEADS, ['id' => $id, 'optin_id' => $optin->id, 'email' => $email, 'phone' => null,
        'fields' => (string) wp_json_encode($data), 'created_at' => current_time('mysql')]);
}
update_option(SubmissionDispatcher::CHECKPOINT, '', false);
for ($page = 0; $page < 10; $page++) { $dispatcher->recover(); }
foreach ($bulkIds as $id) {
    if (($leads->find($id)?->capture['submissions']['email-signup']['handoff'] ?? null) !== 'complete') {
        throw new RuntimeException('Recovery did not cross its batch boundary');
    }
    as_unschedule_all_actions(PushJob::HOOK, [(new PushJob($id, $emailRoute->id, 1, 'email-signup'))->toArgs()], ActionSchedulerQueue::GROUP);
}
journeyCheck(true, 'recovery hands off all 120 pending signups across bounded batches');
$leads->eraseByEmail($email);
as_unschedule_all_actions(SubmissionDispatcher::RECOVER, [], ActionSchedulerQueue::GROUP);
$optins->delete($optin->id);

// Exercise the actual promotion boundary as well as the graph validator.
// A validator-only test missed the repository's former v2-only publish guard.
$graphTree = json_decode((string) file_get_contents(dirname(__DIR__) . '/tests/fixtures/journey-graph-enquiry.json'), true, 32, JSON_THROW_ON_ERROR);
$graphConfig = ['template' => ['tree' => $graphTree], 'capture_mode' => 'local', 'display_type' => 'popup',
    'display_rules' => \WConvert\Rules\DisplayPlan::immediate()];
$graphOptin = $optins->create('Graph enquiry verification', 'collect_enquiries', $graphConfig);
journeyCheck($optins->publish($graphOptin->id) !== null, 'a graph enquiry passes the repository publication boundary');
$graphBase = ['optin_id' => $graphOptin->id, 'contract' => CaptureContract::fingerprint($graphConfig, $graphOptin->goal, get_privacy_policy_url())];
$graphStart = journeyRequest($graphBase + ['phase' => 'start']);
if (!$c->resolve(\WConvert\Goal\GoalRegistry::class)->supportsJourneys()) {
    journeyCheck(($graphStart['error'] ?? '') === 'wconvert_journey_unavailable', 'Free cannot capture a graph that requires Pro');
} else {
    journeyCheck(isset($graphStart['grant']), 'a published graph starts a visitor capture session');
    $graphBody = $graphBase + ['grant' => $graphStart['grant'], 'submission' => 'enquiry',
        'fields' => ['email' => $email], 'question_answers' => ['n1' => ['balcony'], 'n2' => 'small', 'n4' => 'large']];
    $graphCapture = journeyRequest($graphBody);
    journeyCheck(isset($graphCapture['id']), 'a published graph accepts its combined enquiry');
    $graphLead = $leads->find($graphCapture['id']);
    $graphSnapshot = $graphLead?->submission('enquiry');
    journeyCheck(array_column($graphSnapshot->questionAnswers ?? [], 'id') === ['n1', 'n4'],
        'the graph save excludes an answer from a deselected follow-up');
    $graphReplay = journeyRequest($graphBody);
    journeyCheck(($graphReplay['id'] ?? null) === $graphCapture['id'] && ($graphReplay['replay'] ?? false),
        'a repeated graph save returns the same Lead');
    $leads->eraseByEmail($email);
}
$optins->delete($graphOptin->id);
echo "Capture journey verification complete.\n";
