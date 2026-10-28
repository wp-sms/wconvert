<?php

/**
 * verify-destinations.php — the [[Destination]] handoff, on a real WordPress.
 *
 *     wp eval-file bin/verify-destinations.php --use-include
 *
 * Exit 0 = every check passed, 1 = a check failed or its fixtures could not be
 * set up, 2 = it declined to run.
 *
 * WHY THIS EXISTS AND THE UNIT SUITE DOES NOT DO IT. `tests/unit/Destination/`
 * proves the failure split, the payload shape and the fill-empty rule against
 * fakes, which is where those belong. What it cannot prove is that the plugin
 * BOOTS with Action Scheduler bundled beside it, that `as_enqueue_async_action()`
 * is actually defined by the time a capture fires, and that a real capture
 * really does put a job on a real queue carrying ids and no personal data.
 * A green suite is not the same as a plugin that runs (AGENTS.md).
 *
 * Captures go through the visitor's path: `CaptureController` saves the
 * accepted submission, `JourneyCapture::ACCEPTED` fires, and
 * `SubmissionDispatcher` queues one job per bound route. `PushWorker` then reads
 * the accepted submission snapshot the job names. Nothing here calls
 * `LeadCapture::record()`, which is not how a visitor's submission arrives.
 *
 * It runs on SQLite, so Playground is enough. See README's *Running a
 * `bin/verify-*.php` script under Playground*, and *Booting with MailPoet, and
 * without it* for the second shape.
 *
 * IT REFUSES TO RUN ON AN INSTALL THAT HAS LEADS. It captures and then deletes,
 * and it writes to the Destination options. Boot a throwaway WordPress —
 * README.md has the one-liner.
 */

declare(strict_types=1);

use WConvert\Bootstrap;
use WConvert\Database\Installer;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\LeadMagnet\LeadMagnetDestinationType;
use WConvert\Destination\MailPoet\MailPoetDestinationType;
use WConvert\Destination\MailPoet\WpMailPoetSubscribers;
use WConvert\Destination\OptinBinding;
use WConvert\Destination\PushJob;
use WConvert\Destination\PushWorker;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Goal\Goal;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Queue\ActionSchedulerQueue;
use WConvert\Rest\CaptureController;
use WConvert\Rules\DisplayPlan;
use WConvert\Template\CaptureContract;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-destinations.php --use-include\n");

    exit(2);
}

final class DestinationVerification
{
    /** @var list<string> */
    public array $failures = [];

    /**
     * @param mixed $expected
     * @param mixed $actual
     */
    public function check(string $claim, $expected, $actual): void
    {
        if ($expected === $actual) {
            echo "  ok   {$claim}\n";

            return;
        }

        $this->failures[] = $claim;

        echo "  FAIL {$claim}\n";
        echo '       expected: ' . var_export($expected, true) . "\n";
        echo '       actual:   ' . var_export($actual, true) . "\n";
    }

    /**
     * A fixture this script needs could not be set up. Every later check
     * would be about the missing fixture rather than the thing under test, so
     * stop here and say which one.
     */
    public static function stop(string $why): never
    {
        fwrite(STDERR, "Setup failed: {$why}\n");

        exit(1);
    }
}

global $wpdb;

$verify = new DestinationVerification();
$container = Bootstrap::container();

// Loading is not activating: on Playground nothing ran the activation hook.
$container->resolve(Installer::class)->install();

$leadTable = $wpdb->prefix . 'wconvert_leads';
$statsTable = $wpdb->prefix . 'wconvert_stats';

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`") > 0) {
    fwrite(STDERR, "This install already has Leads. Run it on a throwaway WordPress.\n");

    exit(2);
}

// Capture receipts and lead-magnet send reservations are options, written by
// the capture and the delivery. Whatever is new at the end is this script's.
$ownOptions = static function () use ($wpdb): array {
    return $wpdb->get_col($wpdb->prepare(
        "SELECT option_name FROM `{$wpdb->options}` WHERE option_name LIKE %s OR option_name LIKE %s",
        $wpdb->esc_like('wconvert_capture_') . '%',
        $wpdb->esc_like('wconvert_mail_') . '%'
    ));
};
$optionsAtStart = $ownOptions();

// ============================================================================
// THE PROMISE readme.txt PRINTS IN BOLD: no account, no phone-home.
// ============================================================================
// ADR 0007 makes a [[Destination]] that calls out over HTTP a [[Pro]] feature,
// which is why free registers exactly three types and every one of them is
// in-process. `tests/unit/Contract/TheFreeCapturePathStaysInProcessTest.php`
// proves that at the SOURCE, which is the assertion that catches a line
// somebody adds — and this is the other half: the whole of a real capture, a
// real dispatch and a real MailPoet push, watched for a request that actually
// leaves the machine.
//
// `pre_http_request` is the first filter in `WP_Http::request()`, so short-
// circuiting here means nothing is sent and every caller is recorded.
$requests = [];

add_filter('pre_http_request', static function ($short, array $args, string $url) use (&$requests) {
    unset($short, $args);

    $requests[] = $url;

    return new WP_Error('wconvert_verification', 'Blocked: free makes no outbound request.');
}, 0, 3);

echo "Action Scheduler\n";

// The whole reason this file exists. Nothing in the unit suite can tell
// whether the bundled copy loaded, and a queue whose functions are undefined
// fatals inside a capture rather than at boot.
$verify->check('as_enqueue_async_action() is defined', true, function_exists('as_enqueue_async_action'));
$verify->check('as_schedule_single_action() is defined', true, function_exists('as_schedule_single_action'));
$verify->check(
    'its own tables exist',
    true,
    $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}actionscheduler_actions'") !== null
);

echo "\nThe registry\n";

/** @var DestinationRegistry $registry */
$registry = $container->resolve(DestinationRegistry::class);

$verify->check('the WSMS type is registered by free', true, $registry->find(WsmsDestinationType::ID) !== null);

// `unavailable` on a site with no WP SMS, and `ready` where it is loaded —
// either is correct, and both must be a real answer rather than a fatal. What
// it must never be is `locked`: a missing plugin is not something we can sell.
$wsmsAvailability = $registry->availabilityOf(WsmsDestinationType::ID)->value;

echo '  note the WSMS Destination is "' . $wsmsAvailability . "\" here\n";

$verify->check('the WSMS Destination is ready or unavailable, never locked', true, in_array($wsmsAvailability, ['ready', 'unavailable'], true));
$verify->check(
    'and is dispatchable only where WP SMS is loaded',
    $wsmsAvailability === 'ready',
    $registry->isDispatchable(WsmsDestinationType::ID)
);

/** @var DestinationStore $destinations */
$destinations = $container->resolve(DestinationStore::class);
/** @var OptinRepository $optins */
$optins = $container->resolve(OptinRepository::class);
/** @var LeadRepository $leads */
$leads = $container->resolve(LeadRepository::class);
/** @var PushWorker $worker */
$worker = $container->resolve(PushWorker::class);
/** @var HealthStore $health */
$health = $container->resolve(HealthStore::class);

// ============================================================================
// FIXTURES: A CURRENT CAMPAIGN, AND THE VISITOR'S OWN CAPTURE PATH.
// ============================================================================
// A name-and-email form, so a captured value other than the address exists to
// look for in the job arguments. The library ships consent hidden; a Goal
// that grows a list has it revealed at prefill (ADR 0099), which is the shape a
// merchant publishes.
$library = json_decode(
    (string) file_get_contents(dirname(__DIR__) . '/resources/templates/library/name-and-email.json'),
    true,
    64,
    JSON_THROW_ON_ERROR
);

if (!is_array($library) || !is_array($library['tree'] ?? null)) {
    DestinationVerification::stop('resources/templates/library/name-and-email.json is not a design.');
}

/** @var PrivacyGuidance $privacy */
$privacy = $container->resolve(PrivacyGuidance::class);

/** @var list<string> $created */
$created = [];

/**
 * Create and publish a current campaign bound to these Destinations, or stop.
 *
 * @param list<string> $destinationIds
 */
$campaign = static function (string $name, Goal $goal, array $destinationIds) use ($optins, $library, $privacy, &$created): Optin {
    $template = $library;
    $template['tree'] = $privacy->treeFor($library['tree'], $goal);

    $optin = $optins->create($name, $goal->value, [
        'template' => $template,
        'display_type' => 'popup',
        'display_rules' => DisplayPlan::immediate(),
        OptinBinding::KEY => $destinationIds,
    ]);
    $created[] = $optin->id;

    $published = $optins->publish($optin->id);

    if ($published === null) {
        DestinationVerification::stop("the {$goal->value} campaign \"{$name}\" was refused publication.");
    }

    return $published;
};

/**
 * Submit the campaign's first form through the capture route, as a visitor's
 * browser does: start a grant, then send the fields against the published
 * contract. Returns the accepted Lead id, or stops.
 *
 * @param array<string, string> $fields
 */
$capture = static function (Optin $optin, array $fields) use ($container): string {
    $config = $optin->publishedConfig ?? [];
    $base = [
        'optin_id' => $optin->id,
        'contract' => CaptureContract::fingerprint($config, $optin->goal, get_privacy_policy_url()),
    ];

    $request = static function (array $body) use ($container): array {
        $request = new WP_REST_Request('POST', '/wconvert/v1/capture');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body((string) wp_json_encode($body));

        $result = $container->resolve(CaptureController::class)->capture($request);

        if ($result instanceof WP_Error) {
            return ['error' => $result->get_error_code() . ': ' . $result->get_error_message()];
        }

        $data = $result->get_data();

        return is_array($data) ? $data : [];
    };

    $start = $request($base + ['phase' => 'start']);

    if (!is_string($start['grant'] ?? null)) {
        DestinationVerification::stop("no capture grant for {$optin->name}: " . wp_json_encode($start));
    }

    $submission = (string) ($config['template']['tree']['submissions'][0]['id'] ?? '');
    $accepted = $request($base + [
        'grant' => $start['grant'],
        'submission' => $submission,
        'fields' => $fields,
        'consent' => true,
    ]);

    if (!is_string($accepted['id'] ?? null)) {
        DestinationVerification::stop("the capture for {$optin->name} was not accepted: " . wp_json_encode($accepted));
    }

    return $accepted['id'];
};

/** The jobs on the queue right now, as their stored argument arrays. */
$queuedJobs = static function (): array {
    $jobs = [];

    foreach (as_get_scheduled_actions(['hook' => PushJob::HOOK, 'group' => ActionSchedulerQueue::GROUP, 'per_page' => 50], OBJECT) as $action) {
        /** @var array<int, array<string, mixed>> $enqueued */
        $enqueued = $action->get_args();
        $jobs[] = $enqueued[0] ?? [];
    }

    return $jobs;
};

/** The handoff state the accepted submission carries. */
$handoffOf = static function (string $leadId, string $submission = 'primary') use ($leads): mixed {
    return $leads->find($leadId)?->capture['submissions'][$submission]['handoff'] ?? null;
};

echo "\nA capture hands off\n";

// A type that is always dispatchable, so the handoff is exercised whether or
// not this install has WP SMS. Registered here rather than shipped: it is the
// test double, and it lives for the length of this script.
$registry->register(new class () implements \WConvert\Destination\DestinationType {
    public function id(): string
    {
        return 'verify';
    }

    public function label(): string
    {
        return 'Verification';
    }

    public function icon(): string
    {
        return 'dashicons-admin-generic';
    }

    public function tier(): \WConvert\Support\Tier
    {
        return \WConvert\Support\Tier::Free;
    }

    public function requires(): ?\WConvert\Support\SiteDependency
    {
        return null;
    }

    public function connectionSchema(): ?array
    {
        return null;
    }

    /**
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function settingsSchema(array $credentials): array
    {
        unset($credentials);

        return [];
    }

    public function requirements(): \WConvert\Destination\DestinationRequirements
    {
        return new \WConvert\Destination\DestinationRequirements();
    }

    /**
     * @param array<string, mixed> $credentials
     */
    public function testConnection(array $credentials): void
    {
        unset($credentials);
    }

    public function push(
        \WConvert\Destination\PushSubject $subject,
        \WConvert\Destination\PushContext $context
    ): \WConvert\Destination\PushResult {
        unset($subject, $context);

        return \WConvert\Destination\PushResult::success('verified');
    }

    public function throughput(): int
    {
        return 60;
    }
});

$destination = $destinations->save(null, 'verify', 'Verification', null, []);
$optin = $campaign('Verification optin', Goal::GrowEmailList, [$destination->id]);

$leadId = $capture($optin, ['email' => 'verify@example.com', 'name' => 'Verify Person']);

// Through the documented `as_*()` API rather than `ActionScheduler::store()`:
// the functions are the supported surface, and reading the store directly is
// the kind of coupling that breaks on an AS release we do not control.
$queued = $queuedJobs();

$verify->check('a capture put exactly one job on the queue', 1, count($queued));

$args = $queued[0] ?? [];

$verify->check('the job carries the Lead id', $leadId, $args['lead'] ?? null);
$verify->check('and the Destination id', $destination->id, $args['destination'] ?? null);
$verify->check('and the accepted submission it hands off', 'primary', $args['submission'] ?? null);
$verify->check('and nothing else', ['lead', 'destination', 'attempt', 'submission'], array_keys($args));
$verify->check('the accepted submission records its handoff as complete', 'complete', $handoffOf($leadId));

// The claim ADR 0008 rests on, checked against what is genuinely in another
// plugin's table rather than against a fake.
$verify->check(
    'no captured value is anywhere in the stored arguments',
    false,
    str_contains((string) wp_json_encode($args), 'verify@example.com')
        || str_contains((string) wp_json_encode($args), 'Verify Person')
);

echo "\nThe worker\n";

$worker->run($args);

$verify->check(
    'a successful push stamps the Destination health',
    true,
    $health->of($destination->id)->lastSuccessAt !== null
);
$verify->check('and leaves no failures behind it', 0, $health->of($destination->id)->consecutiveFailures);

as_unschedule_all_actions(PushJob::HOOK, [$args], ActionSchedulerQueue::GROUP);

echo "\nThe lead-magnet delivery\n";

// Playground has no mail transport, and neither does most of CI. `pre_wp_mail`
// short-circuits `wp_mail()` before it reaches PHPMailer and is the documented
// way to do it — so this proves the type really calls `wp_mail()` with the
// right arguments, without asking the host to deliver anything.
$mail = [];

add_filter('pre_wp_mail', static function ($short, array $atts) use (&$mail) {
    unset($short);

    $mail[] = $atts;

    return true;
}, 10, 2);

$deliveries = static function (string $optinId) use ($wpdb, $statsTable): int {
    return (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(`count`), 0) FROM `{$statsTable}` WHERE optin_id = %s AND kind = %s",
        $optinId,
        \WConvert\Stats\StatKind::LeadMagnetDelivered->value
    ));
};
$counters = static function () use ($wpdb, $statsTable): int {
    return (int) $wpdb->get_var("SELECT COALESCE(SUM(`count`), 0) FROM `{$statsTable}`");
};

$delivery = $destinations->save(null, LeadMagnetDestinationType::ID, 'Lead magnet email', null, [
    LeadMagnetDestinationType::FILE_URL => 'https://example.com/guide.pdf',
    LeadMagnetDestinationType::SUBJECT => 'Your guide',
    LeadMagnetDestinationType::BODY => 'Thanks! Grab it here: ' . LeadMagnetDestinationType::LINK,
]);

$verify->check(
    'the delivery type is registered by free',
    true,
    $registry->find(LeadMagnetDestinationType::ID) !== null
);

// It needs nothing of the site, so it is `ready` on every install — including
// one with no WP SMS.
$verify->check(
    'and is ready on a Standalone install',
    'ready',
    $registry->availabilityOf(LeadMagnetDestinationType::ID)->value
);

$magnetOptin = $campaign('Guide download', Goal::DeliverLeadMagnet, [$delivery->id]);
$magnetLeadId = $capture($magnetOptin, ['email' => 'magnet@example.com', 'name' => 'Magnet Person']);

// The real handoff first: the delivery runs from the job the capture queued,
// not from one this script built.
$magnetJobs = array_values(array_filter(
    $queuedJobs(),
    static fn (array $job): bool => ($job['lead'] ?? null) === $magnetLeadId
));

$verify->check(
    'the capture queued the delivery for its accepted submission',
    [(new PushJob($magnetLeadId, $delivery->id, 1, 'primary'))->toArgs()],
    $magnetJobs
);

$worker->run($magnetJobs[0] ?? []);
as_unschedule_all_actions(PushJob::HOOK, [$magnetJobs[0] ?? []], ActionSchedulerQueue::GROUP);

$verify->check('the delivery sent exactly one email', 1, count($mail));
$verify->check('to the Lead', 'magnet@example.com', $mail[0]['to'] ?? null);
$verify->check('with the configured subject', 'Your guide', $mail[0]['subject'] ?? null);
$verify->check(
    'and the {link} token substituted for the file',
    'Thanks! Grab it here: https://example.com/guide.pdf',
    $mail[0]['message'] ?? null
);

// The claim the dashboard's failure count rests on, against a real table with a
// real unique key rather than against a fake that records statements.
$verify->check('it counted exactly one delivery', 1, $deliveries($magnetOptin->id));

echo "\n  scoping\n";

// **Type scoping.** The same lead-magnet Lead, pushed to a Destination that is
// not the delivery email. A merchant binding both to one Optin is ordinary, and
// counting this would report two deliveries per Conversion and drive the
// failure count negative.
//
// The worker reads the accepted submission by id, so this needs no rebinding:
// the Optin's routes decide what gets QUEUED, and what is under test here is
// what the worker counts once a job exists.
$worker->run((new PushJob($magnetLeadId, $destination->id, 1, 'primary'))->toArgs());

$verify->check(
    'a non-delivery type succeeding on a lead-magnet Optin counts nothing',
    1,
    $deliveries($magnetOptin->id)
);

// **Goal scoping.** The delivery Destination, on an Optin whose Goal is not
// measured in deliveries. The email goes out — the merchant asked for it — and
// no counter moves, because no card would read the row.
$otherLeadId = $capture($optin, ['email' => 'other@example.com']);

foreach ($queuedJobs() as $job) {
    as_unschedule_all_actions(PushJob::HOOK, [$job], ActionSchedulerQueue::GROUP);
}

$worker->run((new PushJob($otherLeadId, $delivery->id, 1, 'primary'))->toArgs());

$verify->check('a delivery on another Goal still sends', 2, count($mail));
$verify->check('and counts nothing', 0, $deliveries($optin->id));

echo "\nThe test send\n";

// **The claim is that no row was written, and only a database can be watched
// not writing one.** ADR 0031 makes a [[Lead]] a capture event with exactly one
// origin, so a merchant proving their credentials work must leave
// `wconvert_leads` exactly as they found it — and a fake that models the table
// cannot prove that about the table.
$leadCount = static function () use ($wpdb, $leadTable): int {
    return (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`");
};
$leadsBefore = $leadCount();
$queuedBefore = count($queuedJobs());
$countersBefore = $counters();
$countedBefore = $deliveries($magnetOptin->id);

/** @var \WConvert\Destination\PushDispatcher $dispatcher */
$dispatcher = $container->resolve(\WConvert\Destination\PushDispatcher::class);

// The recipient is explicit: a test send goes where the merchant says, and
// only there.
$sent = $dispatcher->test($delivery->id, ['email' => 'merchant@example.com', 'nickname' => 'Dropped']);

$verify->check('a test send reaches the Destination', 'success', $sent->outcome->value);
$verify->check('and sent a third email', 3, count($mail));
$verify->check('and it went to the merchant, not to a Lead', 'merchant@example.com', $mail[2]['to'] ?? null);
$verify->check('a test send writes no Lead row', $leadsBefore, $leadCount());
$verify->check('and queues nothing', $queuedBefore, count($queuedJobs()));
$verify->check('and moves no delivery counter', $countedBefore, $deliveries($magnetOptin->id));
$verify->check('nor any other counter', $countersBefore, $counters());

echo "\n  from the screen\n";

// **The routes, not the dispatcher.** The unit suite proves the two negatives
// against fakes; what it cannot prove is that the routes register on a real
// WordPress and answer through them.
/** @var \WConvert\Rest\DestinationController $controller */
$controller = $container->resolve(\WConvert\Rest\DestinationController::class);

$asked = static function (string $method, string $destinationId, ?string $email = null) use ($controller): array {
    $request = new WP_REST_Request('POST');
    $request->set_param('id', $destinationId);

    if ($email !== null) {
        $request->set_param('email', $email);
    }

    $answer = $controller->{$method}($request);
    $data = $answer instanceof WP_REST_Response ? $answer->get_data() : null;

    return is_array($data) ? $data : ['outcome' => 'error'];
};

$optionsBefore = [
    'health' => get_option(HealthStore::OPTION),
    'failures' => get_option(\WConvert\Destination\DeliveryFailures::OPTION),
];
$leadsBeforeTest = $leadCount();

// **There is no implicit recipient.** The profile address is a suggestion the
// screen shows, never somewhere the route sends on its own: with no address
// the route refuses in its own words and sends nothing — logged in or not.
wp_set_current_user(0);

$verify->check(
    'with no address the route refuses rather than guessing one',
    'failed',
    $asked('testSend', $delivery->id)['outcome'] ?? null
);

$administrators = get_users(['role' => 'administrator', 'number' => 1, 'fields' => 'ID']);
wp_set_current_user($administrators === [] ? 0 : (int) $administrators[0]);

$verify->check(
    'and refuses for a logged-in merchant too, whose profile has an address',
    'failed',
    $asked('testSend', $delivery->id)['outcome'] ?? null
);
$verify->check('and sent nothing', 3, count($mail));

$sentFromScreen = $asked('testSend', $delivery->id, 'merchant@example.com');

$verify->check('an explicit address really sends', 'success', $sentFromScreen['outcome'] ?? null);
$verify->check('and it is a fourth email', 4, count($mail));
$verify->check('to the address the merchant gave', 'merchant@example.com', $mail[3]['to'] ?? null);
$verify->check(
    'and the sentence names the Destination it proved',
    true,
    str_contains((string) ($sentFromScreen['message'] ?? ''), 'Lead magnet email')
);

$connected = $asked('testConnection', $delivery->id);

// Every free type authenticates against nothing, so the honest answer is that
// there is nothing to check — never a green tick, which would teach a merchant
// that this button means "this works".
$verify->check('the test-connection route says there is nothing to check', 'skipped', $connected['outcome'] ?? null);

wp_set_current_user(0);

// ============================================================================
// THE RULE MOST LIKELY TO BE BROKEN BY A CARELESS CONTROLLER.
// ============================================================================
// Delivery state is about Leads that were captured (ADR 0008), and a test
// captured none. Read against the real options rather than a fake that models
// them.
$verify->check('a test from the screen writes no health', $optionsBefore['health'], get_option(HealthStore::OPTION));
$verify->check('no delivery failure', $optionsBefore['failures'], get_option(\WConvert\Destination\DeliveryFailures::OPTION));
$verify->check('no delivery counter', $countedBefore, $deliveries($magnetOptin->id));
$verify->check('no counter of any kind', $countersBefore, $counters());
$verify->check('and no Lead row', $leadsBeforeTest, $leadCount());

echo "\nThe MailPoet push\n";

// **This whole section is conditional, and that is the point of it.** A site
// with no MailPoet is the majority case and it must be a clean answer rather
// than a fatal — the type is `unavailable` there, its schema still renders,
// and nothing is enqueued (#30). Boot Playground with the `installPlugin` step
// for MailPoet to exercise the other half; README's Verifying section has the
// blueprint.
$verify->check(
    'the MailPoet type is registered by free',
    true,
    $registry->find(MailPoetDestinationType::ID) !== null
);
$verify->check(
    'it needs no Connection, so no credential is ever created for it',
    true,
    $registry->find(MailPoetDestinationType::ID)?->connectionSchema() === null
);

$mailPoetAvailability = $registry->availabilityOf(MailPoetDestinationType::ID)->value;

echo '  note the MailPoet Destination is "' . $mailPoetAvailability . "\" here\n";

if ($mailPoetAvailability !== 'ready') {
    // The absent case, asserted rather than skipped past. `settingsSchema()`
    // is called for every registered type on every read of the Destinations
    // screen, whatever its Availability, so it is the path that reaches the
    // adapter first on a site that has no MailPoet to reach.
    $schema = $registry->find(MailPoetDestinationType::ID)?->settingsSchema([]) ?? [];

    $verify->check('its schema still answers with MailPoet absent', true, isset($schema['lists']));
    $verify->check('and offers no lists to choose from', false, isset($schema['lists']['options']));
    $verify->check('and it is skipped rather than dispatchable', false, $registry->isDispatchable(MailPoetDestinationType::ID));

    // And a capture bound to it still saves, queues nothing for it, and says
    // which route it could not hand to.
    $absent = $destinations->save(null, MailPoetDestinationType::ID, 'MailPoet', null, [MailPoetDestinationType::LISTS => []]);
    $absentOptin = $campaign('MailPoet absent', Goal::GrowEmailList, [$absent->id]);
    $absentLeadId = $capture($absentOptin, ['email' => 'mailpoet-absent@example.com']);
    $absentSnapshot = $leads->find($absentLeadId)?->capture['submissions']['primary'] ?? [];

    $verify->check(
        'a capture bound to it queues nothing',
        [],
        array_values(array_filter($queuedJobs(), static fn (array $job): bool => ($job['lead'] ?? null) === $absentLeadId))
    );
    $verify->check('and still completes its handoff', 'complete', $absentSnapshot['handoff'] ?? null);
    $verify->check('naming the route it skipped', [$absent->id], $absentSnapshot['unavailable_routes'] ?? null);

    $destinations->delete($absent->id);
    $health->forget($absent->id);
} else {
    // One call into MailPoet, by NAME rather than as a literal method — the
    // same reason `WpMailPoetSubscribers::call()` gives: the class this would
    // be checked against is not on the machine running the analyser.
    $mailpoet = static function (string $method, ...$arguments) {
        $api = \MailPoet\API\API::MP('v1');

        if (!is_object($api)) {
            throw new RuntimeException('MailPoet did not supply its plugin API.');
        }

        return $api->{$method}(...$arguments);
    };

    // ------------------------------------------------------------------
    // THE THREE NUMBERS THE ADAPTER COPIED OUT OF MAILPOET.
    // ------------------------------------------------------------------
    // `WpMailPoetSubscribers` reads `APIException`'s codes to tell "already
    // there" and "landed, but its email did not" from a real failure. Nothing
    // in the unit suite can check them — it has no MailPoet — and a renumber
    // upstream would turn every capture into a health failure that heals
    // itself on retry, which is exactly the shape nobody investigates.
    $codes = 'MailPoet\API\MP\v1\APIException';

    $verify->check(
        'MailPoet still numbers SUBSCRIBER_EXISTS as the adapter expects',
        constant($codes . '::SUBSCRIBER_EXISTS'),
        WpMailPoetSubscribers::CODE_SUBSCRIBER_EXISTS
    );
    $verify->check(
        'and its two "landed, but the email did not" codes',
        [constant($codes . '::CONFIRMATION_FAILED_TO_SEND'), constant($codes . '::WELCOME_FAILED_TO_SEND')],
        WpMailPoetSubscribers::CODES_LANDED_ANYWAY
    );

    $listA = $mailpoet('addList', ['name' => 'WConvert verification A']);
    $listB = $mailpoet('addList', ['name' => 'WConvert verification B']);

    $schema = $registry->find(MailPoetDestinationType::ID)?->settingsSchema([]) ?? [];
    $offered = array_column($schema['lists']['options'] ?? [], 'label', 'value');

    // The merchant chooses a list BY NAME. This is the admin-time read of the
    // provider's shape ADR 0007 permits, and the reason nobody has to paste a
    // segment id read off a URL.
    $verify->check('the settings surface lists the site’s lists by name', 'WConvert verification A', $offered[$listA['id']] ?? null);

    $mailPoetDestination = $destinations->save(null, MailPoetDestinationType::ID, 'MailPoet', null, [
        MailPoetDestinationType::LISTS => [(string) $listA['id'], (string) $listB['id']],
    ]);

    $mailPoetOptin = $campaign('MailPoet optin', Goal::GrowEmailList, [$mailPoetDestination->id]);

    // One push of the job the capture queued, and what it reported.
    //
    // `PushWorker::run()` returns nothing — health is where an outcome lands,
    // and it is what a merchant would be looking at. `landed()` clears
    // `last_error` and `failed()` stamps it, so a null here is the push having
    // SUCCEEDED rather than having gone back on the queue. Asserting only
    // MailPoet's rows would pass just as well if every push had failed
    // retryably and healed itself on the next attempt, which is the shape
    // nobody investigates because the data looks right.
    $pushed = static function (string $leadId) use ($worker, $health, $mailPoetDestination, $queuedJobs, $verify): ?string {
        $jobs = array_values(array_filter($queuedJobs(), static fn (array $job): bool => ($job['lead'] ?? null) === $leadId));
        $job = $jobs[0] ?? (new PushJob($leadId, $mailPoetDestination->id, 1, 'primary'))->toArgs();

        $verify->check(
            'the capture queued its MailPoet handoff',
            (new PushJob($leadId, $mailPoetDestination->id, 1, 'primary'))->toArgs(),
            $job
        );

        $worker->run($job);

        return $health->of($mailPoetDestination->id)->lastError;
    };

    // ------------------------------------------------------------------
    // 1. Somebody MailPoet has never heard of.
    // ------------------------------------------------------------------
    $newLeadId = $capture($mailPoetOptin, ['email' => 'mailpoet-new@example.com', 'name' => 'New Person']);

    $verify->check('a capture lands rather than going back on the queue', null, $pushed($newLeadId));

    $created = $mailpoet('getSubscriber', 'mailpoet-new@example.com');

    $verify->check('a capture creates one MailPoet subscriber', 'mailpoet-new@example.com', $created['email'] ?? null);
    $verify->check('with the captured name, whole and unsplit', 'New Person', $created['first_name'] ?? null);
    $verify->check(
        'on both configured lists',
        ['subscribed', 'subscribed'],
        array_values(array_map(
            static fn (array $s): string => (string) $s['status'],
            array_filter(
                $created['subscriptions'] ?? [],
                static fn (array $s): bool => in_array((string) $s['segment_id'], [(string) $listA['id'], (string) $listB['id']], true)
            )
        ))
    );

    // **Idempotency, against a real unique index.** A retry re-runs the whole
    // of push(); MailPoet's `mailpoet_subscribers.email` is unique, so a second
    // create would collide and the push finishes by list instead (ADR 0008).
    // **An ordinary retry never reaches `SubscriberExists` at all**, and that
    // is worth knowing rather than assuming: `push()` matches first, so the
    // second attempt finds the subscriber the first one made and finishes by
    // list. The exists path is the RACE — another writer landing the row
    // between our read and our write — which is why the code behind it is
    // pinned against MailPoet's own class above rather than left to a
    // scenario this script cannot stage.
    $worker->run((new PushJob($newLeadId, $mailPoetDestination->id, 2, 'primary'))->toArgs());

    $verify->check('and a retry lands too', null, $health->of($mailPoetDestination->id)->lastError);

    $retried = $mailpoet('getSubscriber', 'mailpoet-new@example.com');

    $verify->check('a retry adds no second subscriber', $created['id'], $retried['id'] ?? null);
    $verify->check(
        'and no second membership',
        count($created['subscriptions'] ?? []),
        count($retried['subscriptions'] ?? [])
    );

    // ------------------------------------------------------------------
    // 2. Somebody who left. THE ASSERTION THIS WHOLE SECTION EXISTS FOR.
    // ------------------------------------------------------------------
    // No fake can prove this, because what it is about is which method of
    // another plugin's API was called: MailPoet's own `subscribeToLists()`
    // moves a non-subscribed subscriber's global status on the way past, and
    // the adapter therefore does not call it (ADR 0022). This is the only
    // place that difference is observable.
    //
    // The three options below are the FIXTURE's, not the push's. WConvert
    // passes none of them: whether a new subscriber has to confirm is
    // MailPoet's own signup-confirmation setting and the site's decision
    // (ADR 0016). They are here only so setting up a known state does not send
    // anybody anything.
    $mailpoet(
        'addSubscriber',
        ['email' => 'mailpoet-left@example.com', 'first_name' => 'Stored Name'],
        [(int) $listA['id']],
        ['send_confirmation_email' => false, 'schedule_welcome_email' => false, 'skip_subscriber_notification' => true]
    );
    $mailpoet('unsubscribe', 'mailpoet-left@example.com');

    $before = $mailpoet('getSubscriber', 'mailpoet-left@example.com');

    $verify->check('a subscriber who unsubscribed starts unsubscribed', 'unsubscribed', $before['status'] ?? null);

    $leftLeadId = $capture($mailPoetOptin, ['email' => 'mailpoet-left@example.com', 'name' => 'Typo Name']);

    $verify->check('a capture for someone MailPoet already holds lands', null, $pushed($leftLeadId));

    $after = $mailpoet('getSubscriber', 'mailpoet-left@example.com');
    $memberships = [];

    foreach ($after['subscriptions'] ?? [] as $subscription) {
        $memberships[(string) $subscription['segment_id']] = (string) $subscription['status'];
    }

    $verify->check('a capture never flips them back to subscribed', 'unsubscribed', $after['status'] ?? null);
    $verify->check(
        'the list they left is still left',
        'unsubscribed',
        $memberships[(string) $listA['id']] ?? null
    );
    $verify->check(
        'and the list they had no row for is added',
        'subscribed',
        $memberships[(string) $listB['id']] ?? null
    );

    // Nothing else about the person was touched. The push fills no blanks on a
    // match: MailPoet's only public update path restamps `source` and
    // `subscribed_ip` too, and WConvert has no honest IP to supply (ADR 0017).
    $verify->check('and their stored name is untouched', 'Stored Name', $after['first_name'] ?? null);
    $verify->check('and so is their provenance', $before['source'] ?? null, $after['source'] ?? null);

    echo "\n  cleaning up MailPoet\n";

    $mailpoet('unsubscribe', 'mailpoet-new@example.com');

    $wpdb->query($wpdb->prepare(
        "DELETE FROM `{$wpdb->prefix}mailpoet_subscriber_segment` WHERE segment_id IN (%d, %d)",
        (int) $listA['id'],
        (int) $listB['id']
    ));
    $wpdb->query($wpdb->prepare(
        "DELETE FROM `{$wpdb->prefix}mailpoet_subscribers` WHERE email IN (%s, %s)",
        'mailpoet-new@example.com',
        'mailpoet-left@example.com'
    ));
    $wpdb->query($wpdb->prepare(
        "DELETE FROM `{$wpdb->prefix}mailpoet_segments` WHERE id IN (%d, %d)",
        (int) $listA['id'],
        (int) $listB['id']
    ));

    $destinations->delete($mailPoetDestination->id);
    $health->forget($mailPoetDestination->id);
}

echo "\nNo account, no phone-home\n";

// Everything above ran: a real capture, a real handoff, a real worker, the
// lead-magnet delivery, a test send and — where MailPoet is installed — a real
// subscriber write. If free's capture path reaches the network at all, it
// reached it inside that.
$verify->check('free made no outbound HTTP request at all', [], $requests);

echo "\nCleaning up\n";

as_unschedule_all_actions(PushJob::HOOK, [], ActionSchedulerQueue::GROUP);

foreach ($queuedJobs() as $job) {
    as_unschedule_all_actions(PushJob::HOOK, [$job], ActionSchedulerQueue::GROUP);
}

$destinations->delete($destination->id);
$destinations->delete($delivery->id);
$health->forget($destination->id);
$health->forget($delivery->id);
delete_option(\WConvert\Destination\DeliveryFailures::OPTION);
$wpdb->query("DELETE FROM `{$leadTable}`");

foreach ($created as $id) {
    $wpdb->query($wpdb->prepare("DELETE FROM `{$statsTable}` WHERE optin_id = %s", $id));
    $wpdb->query($wpdb->prepare("DELETE FROM `{$wpdb->prefix}wconvert_optins` WHERE id = %s", $id));
    $wpdb->query($wpdb->prepare(
        "DELETE FROM `{$wpdb->options}` WHERE option_name LIKE %s",
        $wpdb->esc_like('wconvert_flow_' . $id . '_') . '%'
    ));
}

foreach (array_diff($ownOptions(), $optionsAtStart) as $name) {
    delete_option((string) $name);
}

// The published set is derived state rebuilt on write, so it has to be told
// that the campaigns it points at have just stopped existing (ADR 0003).
$optins->rebuildForInstall();

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
