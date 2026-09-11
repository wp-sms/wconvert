<?php

/**
 * verify-destinations.php — the [[Destination]] dispatch, on a real WordPress.
 *
 *     wp eval-file bin/verify-destinations.php
 *
 * Exit 0 = every check passed, 1 = a check failed, 2 = it declined to run.
 *
 * WHY THIS EXISTS AND THE UNIT SUITE DOES NOT DO IT. `tests/unit/Destination/`
 * proves the failure split, the payload shape and the fill-empty rule against
 * fakes, which is where those belong. What it cannot prove is that the plugin
 * BOOTS with Action Scheduler bundled beside it, that `as_enqueue_async_action()`
 * is actually defined by the time a capture fires, and that a real capture
 * really does put a job on a real queue carrying two ids and no personal data.
 * A green suite is not the same as a plugin that runs (CLAUDE.md).
 *
 * IT REFUSES TO RUN ON AN INSTALL THAT HAS LEADS. It captures and then deletes,
 * and it writes to the Destination options. Boot a throwaway WordPress —
 * README.md has the one-liner.
 */

declare(strict_types=1);

use WConvert\Bootstrap;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\LeadMagnet\LeadMagnetDestinationType;
use WConvert\Destination\MailPoet\MailPoetDestinationType;
use WConvert\Destination\MailPoet\WpMailPoetSubscribers;
use WConvert\Destination\OptinBinding;
use WConvert\Destination\PushJob;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Goal\Goal;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\Submission;
use WConvert\Optin\OptinRepository;
use WConvert\Queue\ActionSchedulerQueue;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this through WordPress: wp eval-file bin/verify-destinations.php\n");

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
}

global $wpdb;

$verify = new DestinationVerification();
$leadTable = $wpdb->prefix . 'wconvert_leads';

if ((int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`") > 0) {
    fwrite(STDERR, "This install already has Leads. Run it on a throwaway WordPress.\n");

    exit(2);
}

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

$container = Bootstrap::container();

/** @var \WConvert\Destination\DestinationRegistry $registry */
$registry = $container->get(\WConvert\Destination\DestinationRegistry::class);

$verify->check('the WSMS type is registered by free', true, $registry->find(WsmsDestinationType::ID) !== null);

// `unavailable` on a site with no WP SMS, and `ready` where it is loaded —
// either is correct, and both must be a real answer rather than a fatal.
echo '  note the WSMS Destination is "' . $registry->availabilityOf(WsmsDestinationType::ID)->value . "\" here\n";

echo "\nA capture dispatches\n";

/** @var DestinationStore $destinations */
$destinations = $container->get(DestinationStore::class);
/** @var OptinRepository $optins */
$optins = $container->get(OptinRepository::class);

// A type that is always dispatchable, so the dispatch is exercised whether or
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
$design = TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest())->snapshotInto(['template_id' => 'centred-card']);

$optin = $optins->create('Verification optin', 'grow_list', [
    'template' => $design['template'],
    OptinBinding::KEY => [$destination->id],
]);
$optins->publish($optin->id);

/** @var LeadCapture $capture */
$capture = $container->get(LeadCapture::class);

$lead = $capture->record($optin->id, new Submission('verify@example.com', null, ['name' => 'Verify Person']));

// Through the documented `as_*()` API rather than `ActionScheduler::store()`:
// the functions are the supported surface, and reading the store directly is
// the kind of coupling that breaks on an AS release we do not control.
$queued = as_get_scheduled_actions(
    ['hook' => PushJob::HOOK, 'group' => ActionSchedulerQueue::GROUP, 'per_page' => 50],
    OBJECT
);

$verify->check('a capture put exactly one job on the queue', 1, count($queued));

$args = [];

foreach ($queued as $action) {
    /** @var array<int, array<string, mixed>> $enqueued */
    $enqueued = $action->get_args();
    $args = $enqueued[0] ?? [];
}

$verify->check('the job carries the Lead id', $lead->id, $args['lead'] ?? null);
$verify->check('and the Destination id', $destination->id, $args['destination'] ?? null);
$verify->check('and nothing else', ['lead', 'destination', 'attempt'], array_keys($args));

// The claim ADR 0008 rests on, checked against what is genuinely in another
// plugin's table rather than against a fake.
$verify->check(
    'no captured value is anywhere in the stored arguments',
    false,
    str_contains((string) wp_json_encode($args), 'verify@example.com')
        || str_contains((string) wp_json_encode($args), 'Verify Person')
);

echo "\nThe worker\n";

/** @var \WConvert\Destination\PushWorker $worker */
$worker = $container->get(\WConvert\Destination\PushWorker::class);
$worker->run($args);

/** @var HealthStore $health */
$health = $container->get(HealthStore::class);

$verify->check(
    'a successful push stamps the Destination health',
    true,
    $health->of($destination->id)->lastSuccessAt !== null
);
$verify->check('and leaves no failures behind it', 0, $health->of($destination->id)->consecutiveFailures);

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

$statsTable = $wpdb->prefix . 'wconvert_stats';

$deliveries = static function (string $optinId) use ($wpdb, $statsTable): int {
    return (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(`count`), 0) FROM `{$statsTable}` WHERE optin_id = %s AND kind = %s",
        $optinId,
        \WConvert\Stats\StatKind::LeadMagnetDelivered->value
    ));
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
// this one, which has no WP SMS.
$verify->check(
    'and is ready on a Standalone install',
    'ready',
    $registry->availabilityOf(LeadMagnetDestinationType::ID)->value
);

$magnetOptin = $optins->create('Guide download', Goal::DeliverLeadMagnet->value, [
    'template' => $design['template'],
    OptinBinding::KEY => [$delivery->id],
]);
$optins->publish($magnetOptin->id);

$magnetLead = $capture->record(
    $magnetOptin->id,
    new Submission('magnet@example.com', null, ['name' => 'Magnet Person'])
);

$worker->run((new PushJob($magnetLead->id, $delivery->id, 1))->toArgs());

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

// **Type scoping.** The same lead-magnet Optin, pushed to a Destination that is
// not the delivery email. A merchant binding both to one Optin is ordinary, and
// counting this would report two deliveries per Conversion and drive the
// failure count negative.
//
// The worker takes the two ids directly, so this needs no rebinding: the
// Optin's Destination list decides what gets DISPATCHED, and what is under test
// here is what the worker counts once a job exists.
$worker->run((new PushJob($magnetLead->id, $destination->id, 1))->toArgs());

$verify->check(
    'a non-delivery type succeeding on a lead-magnet Optin counts nothing',
    1,
    $deliveries($magnetOptin->id)
);

// **Goal scoping.** The delivery Destination, on an Optin whose Goal is not
// measured in deliveries. The email goes out — the merchant asked for it — and
// no counter moves, because no card would read the row.
$otherLead = $capture->record($optin->id, new Submission('other@example.com', null, []));

$worker->run((new PushJob($otherLead->id, $delivery->id, 1))->toArgs());

$verify->check('a delivery on another Goal still sends', 2, count($mail));
$verify->check('and counts nothing', 0, $deliveries($optin->id));

echo "\nThe test send\n";

// **The claim is that no row was written, and only a database can be watched
// not writing one.** ADR 0031 makes a [[Lead]] a capture event with exactly one
// origin, so a merchant proving their credentials work must leave
// `wconvert_leads` exactly as they found it — and a fake that models the table
// cannot prove that about the table.
$leadsBefore = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`");
$queuedBefore = count(as_get_scheduled_actions(
    ['hook' => PushJob::HOOK, 'group' => ActionSchedulerQueue::GROUP, 'per_page' => 50],
    OBJECT
));
$countedBefore = $deliveries($magnetOptin->id);

/** @var \WConvert\Destination\PushDispatcher $dispatcher */
$dispatcher = $container->get(\WConvert\Destination\PushDispatcher::class);

$sent = $dispatcher->test($delivery->id, ['email' => 'merchant@example.com', 'nickname' => 'Dropped']);

$verify->check('a test send reaches the Destination', 'success', $sent->outcome->value);
$verify->check('and sent a third email', 3, count($mail));
$verify->check('and it went to the merchant, not to a Lead', 'merchant@example.com', $mail[2]['to'] ?? null);
$verify->check(
    'a test send writes no Lead row',
    $leadsBefore,
    (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`")
);
$verify->check(
    'and queues nothing',
    $queuedBefore,
    count(as_get_scheduled_actions(
        ['hook' => PushJob::HOOK, 'group' => ActionSchedulerQueue::GROUP, 'per_page' => 50],
        OBJECT
    ))
);
$verify->check('and moves no delivery counter', $countedBefore, $deliveries($magnetOptin->id));

echo "\n  from the screen\n";

// **The routes, not the dispatcher.** The unit suite proves the two negatives
// against fakes; what it cannot prove is that the routes register on a real
// WordPress and that `wp_get_current_user()` really answers with an address —
// the default a test send goes to, and a fatal if the controller reached for
// something WordPress does not have on a REST request (#88).
/** @var \WConvert\Rest\DestinationController $controller */
$controller = $container->get(\WConvert\Rest\DestinationController::class);

$asked = static function (string $method, string $destinationId, ?string $email = null) use ($controller) {
    $request = new WP_REST_Request('POST');
    $request->set_param('id', $destinationId);

    if ($email !== null) {
        $request->set_param('email', $email);
    }

    $answer = $controller->{$method}($request);

    return $answer instanceof WP_REST_Response ? $answer->get_data() : ['outcome' => 'error'];
};

$optionsBefore = [
    'health' => get_option(\WConvert\Destination\HealthStore::OPTION),
    'failures' => get_option(\WConvert\Destination\DeliveryFailures::OPTION),
];
$leadsBeforeTest = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`");

// **No logged-in user, which is exactly what a CLI request is.** The address
// defaults to the merchant's own and there is nobody to ask, so the route says
// so in its own words. That sentence is the whole reason this branch is
// guarded: unguarded, the merchant reads the lead-magnet type's *"the Lead
// carries no email address"*, which is true, internal, and no help to somebody
// who pressed a button (ADR 0042). A REST request from wp-admin always has a
// user, so this is the path only a script and a cron run take.
$verify->check(
    'with nobody logged in the route says it has nowhere to send',
    'skipped',
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

// ============================================================================
// THE RULE MOST LIKELY TO BE BROKEN BY A CARELESS CONTROLLER.
// ============================================================================
// Delivery state is about Leads that were captured (ADR 0008), and a test
// captured none. Read against the real options rather than a fake that models
// them.
$verify->check('a test from the screen writes no health', $optionsBefore['health'], get_option(\WConvert\Destination\HealthStore::OPTION));
$verify->check('no delivery failure', $optionsBefore['failures'], get_option(\WConvert\Destination\DeliveryFailures::OPTION));
$verify->check('no delivery counter', $countedBefore, $deliveries($magnetOptin->id));
$verify->check(
    'and no Lead row',
    $leadsBeforeTest,
    (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$leadTable}`")
);

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

    // One push, and what it reported.
    //
    // `PushWorker::run()` returns nothing — health is where an outcome lands,
    // and it is what a merchant would be looking at. `landed()` clears
    // `last_error` and `failed()` stamps it, so a null here is the push having
    // SUCCEEDED rather than having gone back on the queue. Asserting only
    // MailPoet's rows would pass just as well if every push had failed
    // retryably and healed itself on the next attempt, which is the shape
    // nobody investigates because the data looks right.
    $pushed = static function (string $leadId) use ($worker, $health, &$mailPoetDestination): ?string {
        $worker->run((new PushJob($leadId, $mailPoetDestination->id, 1))->toArgs());

        return $health->of($mailPoetDestination->id)->lastError;
    };

    $mailPoetOptin = $optins->create('MailPoet optin', 'grow_list', [
        'template' => $design['template'],
        OptinBinding::KEY => [$mailPoetDestination->id],
    ]);
    $optins->publish($mailPoetOptin->id);

    // ------------------------------------------------------------------
    // 1. Somebody MailPoet has never heard of.
    // ------------------------------------------------------------------
    $newLead = $capture->record(
        $mailPoetOptin->id,
        new Submission('mailpoet-new@example.com', null, ['name' => 'New Person'])
    );

    $verify->check('a capture lands rather than going back on the queue', null, $pushed($newLead->id));

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
    // create collides and the push finishes by list instead (ADR 0008).
    // **An ordinary retry never reaches `SubscriberExists` at all**, and that
    // is worth knowing rather than assuming: `push()` matches first, so the
    // second attempt finds the subscriber the first one made and finishes by
    // list. The exists path is the RACE — another writer landing the row
    // between our read and our write — which is why the code behind it is
    // pinned against MailPoet's own class above rather than left to a
    // scenario this script cannot stage.
    $verify->check('and a retry lands too', null, $pushed($newLead->id));

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

    $leftLead = $capture->record(
        $mailPoetOptin->id,
        new Submission('mailpoet-left@example.com', null, ['name' => 'Typo Name'])
    );

    $verify->check('a capture for someone MailPoet already holds lands', null, $pushed($leftLead->id));

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
    $wpdb->query($wpdb->prepare(
        "DELETE FROM `{$wpdb->prefix}wconvert_optins` WHERE id = %s",
        $mailPoetOptin->id
    ));
}

echo "\nNo account, no phone-home\n";

// Everything above ran: a real capture, a real dispatch, a real worker, the
// lead-magnet delivery, a test send and — where MailPoet is installed — a real
// subscriber write. If free's capture path reaches the network at all, it
// reached it inside that.
$verify->check('free made no outbound HTTP request at all', [], $requests);

echo "\nCleaning up\n";

as_unschedule_all_actions(PushJob::HOOK, [], ActionSchedulerQueue::GROUP);

$destinations->delete($destination->id);
$destinations->delete($delivery->id);
$health->forget($destination->id);
$health->forget($delivery->id);
delete_option(\WConvert\Destination\DeliveryFailures::OPTION);
$wpdb->query("DELETE FROM `{$leadTable}`");
$wpdb->query($wpdb->prepare("DELETE FROM `{$statsTable}` WHERE optin_id IN (%s, %s)", $optin->id, $magnetOptin->id));
$wpdb->query($wpdb->prepare(
    "DELETE FROM `{$wpdb->prefix}wconvert_optins` WHERE id IN (%s, %s)",
    $optin->id,
    $magnetOptin->id
));

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
