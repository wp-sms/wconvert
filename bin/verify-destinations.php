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
use WConvert\Destination\OptinBinding;
use WConvert\Destination\PushJob;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\Submission;
use WConvert\Optin\OptinRepository;
use WConvert\Queue\ActionSchedulerQueue;

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

    /**
     * @param array<string, mixed> $credentials
     */
    public function testConnection(array $credentials): void
    {
        unset($credentials);
    }

    public function push(
        \WConvert\Lead\Lead $lead,
        \WConvert\Destination\PushContext $context
    ): \WConvert\Destination\PushResult {
        unset($lead, $context);

        return \WConvert\Destination\PushResult::success('verified');
    }

    public function throughput(): int
    {
        return 60;
    }
});

$destination = $destinations->save(null, 'verify', 'Verification', null, []);

$optin = $optins->create('Verification optin', 'grow_list', [
    'template' => ['tree' => ['steps' => []]],
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

echo "\nCleaning up\n";

as_unschedule_all_actions(PushJob::HOOK, [], ActionSchedulerQueue::GROUP);

$destinations->delete($destination->id);
$health->forget($destination->id);
delete_option(\WConvert\Destination\DeliveryFailures::OPTION);
$wpdb->query("DELETE FROM `{$leadTable}`");
$wpdb->query($wpdb->prepare("DELETE FROM `{$wpdb->prefix}wconvert_optins` WHERE id = %s", $optin->id));

echo "\n";

if ($verify->failures !== []) {
    echo count($verify->failures) . " check(s) failed.\n";

    exit(1);
}

echo "Every check passed.\n";

exit(0);
