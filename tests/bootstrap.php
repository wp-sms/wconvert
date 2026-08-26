<?php

/**
 * PHPUnit bootstrap.
 *
 * The suite runs standalone: no WordPress, no database. Everything under test
 * here is either a pure function or a class whose WordPress touchpoints are
 * passed in, so a WordPress install would add minutes and prove nothing extra.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

// Both plugin trees guard their files with `defined('ABSPATH') || exit`, so
// nothing loads without it.
if (!defined('ABSPATH')) {
    define('ABSPATH', '/');
}

// Pro carries its own PSR-4 autoloader rather than riding on free's Composer
// map — see the header of pro/src/autoload.php for why. Requiring that same
// file here keeps one definition of where Pro's classes live.
require_once dirname(__DIR__) . '/pro/src/autoload.php';

/*
 * The handful of WordPress functions the units under test call.
 *
 * Deliberately tiny, and deliberately not a WordPress test install: a class
 * that needs more of WordPress than this is a class whose WordPress
 * touchpoints should have been passed in. Each stub is the real function's
 * documented behaviour for the arguments WConvert actually passes.
 */
if (!function_exists('current_time')) {
    function current_time(string $type, int $gmt = 0): string
    {
        return $type === 'mysql' ? gmdate('Y-m-d H:i:s') : (string) time();
    }
}

if (!function_exists('wp_json_encode')) {
    /** @param mixed $data */
    function wp_json_encode($data, int $options = 0): string|false
    {
        return json_encode($data, $options);
    }
}

/*
 * The action hook, and only the action hook.
 *
 * `wconvert_lead_captured` is the seam a [[Destination]] dispatch attaches to
 * (#30), and the ordering guarantee around it — the local row written FIRST and
 * ALWAYS, before anything else runs (ADR 0007) — is a property of WConvert's own
 * code that a test has to be able to observe. So the two functions that make a
 * hook a hook are here, and nothing else of WordPress's plugin API is.
 *
 * **PRIORITY IS HONOURED**, and that is not decoration either. [[Pro]] replaces
 * free's loader by dequeuing it on the SAME hook at a LATER priority (ADR 0014),
 * so a stub that fired callbacks in registration order would let a swap that
 * only works because Pro's plugin file happens to load second pass as one that
 * works because it asked to run later.
 *
 * @var array<string, list<array{callback: callable, priority: int, order: int}>> $wconvertTestActions
 */
$GLOBALS['wconvertTestActions'] = [];

if (!function_exists('add_action')) {
    function add_action(string $hook, callable $callback, int $priority = 10, int $args = 1): bool
    {
        $GLOBALS['wconvertTestActions'][$hook][] = [
            'callback' => $callback,
            'priority' => $priority,
            // Registration order, so equal priorities keep it — which is what
            // WordPress does and is the half a plain sort would lose.
            'order' => count($GLOBALS['wconvertTestActions'][$hook] ?? []),
        ];

        return true;
    }
}

if (!function_exists('do_action')) {
    /** @param mixed ...$args */
    function do_action(string $hook, ...$args): void
    {
        $callbacks = $GLOBALS['wconvertTestActions'][$hook] ?? [];

        usort(
            $callbacks,
            static fn (array $a, array $b): int => [$a['priority'], $a['order']] <=> [$b['priority'], $b['order']]
        );

        foreach ($callbacks as $registered) {
            $registered['callback'](...$args);
        }
    }
}

if (!function_exists('remove_all_actions')) {
    function remove_all_actions(string $hook, ?int $priority = null): bool
    {
        unset($GLOBALS['wconvertTestActions'][$hook]);

        return true;
    }
}

/*
 * The script queue, recorded rather than performed.
 *
 * WordPress has no other seam for "what will this page load". [[Pro]] ships a
 * COMPLETE replacement loader and dequeues free's in PHP, and the property that
 * matters — **exactly one loader on the page, whatever an aggregating optimizer
 * then does to it** (ADR 0004, ADR 0014) — is a property of this queue at the
 * moment `wp_enqueue_scripts` finishes. An optimizer only ever sees the queue's
 * output, so a queue holding one loader cannot become a page holding two.
 *
 * Deliberately simpler than the real thing in one way: it does not separate
 * "registered" from "enqueued". Nothing in WConvert registers a script without
 * enqueuing it, so a stub that told the two apart would be modelling a state
 * this codebase cannot reach.
 *
 * @var array<string, array{src: string, ver: string|false, in_footer: bool}> $wconvertTestScripts
 */
$GLOBALS['wconvertTestScripts'] = [];

if (!function_exists('wp_enqueue_script')) {
    /**
     * @param list<string> $deps
     * @param string|false|null $ver
     * @param array<string, mixed>|bool $args
     */
    function wp_enqueue_script(
        string $handle,
        string $src = '',
        array $deps = [],
        $ver = false,
        $args = false
    ): void {
        $GLOBALS['wconvertTestScripts'][$handle] = [
            'src' => $src,
            'ver' => $ver,
            'in_footer' => $args === true || (is_array($args) && ($args['in_footer'] ?? false) === true),
        ];
    }
}

if (!function_exists('wp_dequeue_script')) {
    function wp_dequeue_script(string $handle): void
    {
        unset($GLOBALS['wconvertTestScripts'][$handle]);
    }
}

if (!function_exists('wp_deregister_script')) {
    function wp_deregister_script(string $handle): void
    {
        unset($GLOBALS['wconvertTestScripts'][$handle]);
    }
}

if (!function_exists('wp_script_is')) {
    function wp_script_is(string $handle, string $list = 'enqueued'): bool
    {
        return isset($GLOBALS['wconvertTestScripts'][$handle]);
    }
}

if (!function_exists('esc_url')) {
    function esc_url(string $url): string
    {
        return htmlspecialchars($url, ENT_QUOTES);
    }
}

/*
 * REST route registration, recorded rather than performed.
 *
 * The capture route's `args` is deliberately almost empty: declaring
 * `'type' => 'boolean'` for `consent` would run
 * `rest_sanitize_value_from_schema`, which coerces `"true"`, `"on"` and `"1"`
 * into `true` — and a lenient read is an optional consent checkbox by another
 * name (ADR 0032). That is a property of the REGISTRATION, invisible to every
 * test that goes through the form, so it needs a way to be asserted.
 *
 * @var list<array{namespace: string, route: string, args: array<mixed>}> $wconvertTestRoutes
 */
$GLOBALS['wconvertTestRoutes'] = [];

if (!function_exists('register_rest_route')) {
    /** @param array<mixed> $args */
    function register_rest_route(string $namespace, string $route, array $args = []): bool
    {
        $GLOBALS['wconvertTestRoutes'][] = ['namespace' => $namespace, 'route' => $route, 'args' => $args];

        return true;
    }
}

if (!function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        return $text;
    }
}

/*
 * Plugin activation and deactivation, recorded rather than performed.
 *
 * [[Pro]] going on or off is what changes which loader a page enqueues
 * (ADR 0014), so "activating or deactivating Pro purges the page cache" is a
 * claim about a REGISTRATION — invisible to any test that calls the purge
 * itself. Recording the callback is the only way to assert it is hung on both
 * moments rather than on one.
 *
 * @var array<string, list<callable>> $wconvertTestLifecycle
 */
$GLOBALS['wconvertTestLifecycle'] = ['activate' => [], 'deactivate' => []];

if (!function_exists('register_activation_hook')) {
    function register_activation_hook(string $file, callable $callback): void
    {
        $GLOBALS['wconvertTestLifecycle']['activate'][] = $callback;
    }
}

if (!function_exists('register_deactivation_hook')) {
    function register_deactivation_hook(string $file, callable $callback): void
    {
        $GLOBALS['wconvertTestLifecycle']['deactivate'][] = $callback;
    }
}

// Where Pro's plugin file is, which `pro/src/constants.php` defines at load
// time and which nothing in the unit suite loads that file to get — it calls
// `plugin_dir_url()`, which is more of WordPress than this bootstrap carries.
// It is the file Pro hangs its two lifecycle hooks on.
defined('WCONVERT_PRO_MAIN_FILE') || define('WCONVERT_PRO_MAIN_FILE', dirname(__DIR__) . '/pro/wconvert-pro.php');

// The free plugin's own version, which `src/constants.php` defines at load time
// and which nothing in the unit suite loads that file to get. It reaches
// `_doing_it_wrong()` as the "since" argument.
defined('WCONVERT_VERSION') || define('WCONVERT_VERSION', '0.1.0');

// WordPress's own time constants, which any plugin may assume are defined.
defined('HOUR_IN_SECONDS') || define('HOUR_IN_SECONDS', 3600);
defined('DAY_IN_SECONDS') || define('DAY_IN_SECONDS', 86400);

/*
 * A UTC MySQL datetime in the site's own timezone.
 *
 * The identity is not a shortcut: `current_time()` above answers as though the
 * site were on UTC, so a `get_date_from_gmt()` that shifted would make the two
 * stubs disagree about what time it is — and the lead log renders a group's
 * `latest_at` beside a Lead's `created_at`, which is exactly where a
 * disagreement would show.
 */
if (!function_exists('get_date_from_gmt')) {
    function get_date_from_gmt(string $datetime, string $format = 'Y-m-d H:i:s'): string
    {
        return gmdate($format, (int) strtotime($datetime . ' UTC'));
    }
}

/*
 * The inverse of the stub above, and identical for the same reason: this
 * suite's clock is UTC throughout, so the two must agree about what time it
 * is. Bulk re-push turns a Destination's `last_success_at` — written by
 * `current_time('mysql')`, in the SITE's zone — into the real epoch a ULID
 * boundary is built from, and only WordPress knows the offset (ADR 0008).
 */
if (!function_exists('get_gmt_from_date')) {
    function get_gmt_from_date(string $datetime, string $format = 'Y-m-d H:i:s'): string
    {
        return gmdate($format, (int) strtotime($datetime . ' UTC'));
    }
}

/*
 * The filter hook, alongside the action hook above.
 *
 * WordPress's personal-data exporter and eraser are REGISTRATIONS on
 * `wp_privacy_personal_data_exporters` / `_erasers` — a filter each — so the
 * only way to assert WConvert registers one, and exactly one, is to be able to
 * run the filter (ADR 0018).
 *
 * @var array<string, list<callable>> $wconvertTestFilters
 */
$GLOBALS['wconvertTestFilters'] = [];

if (!function_exists('add_filter')) {
    function add_filter(string $hook, callable $callback, int $priority = 10, int $args = 1): bool
    {
        $GLOBALS['wconvertTestFilters'][$hook][] = $callback;

        return true;
    }
}

if (!function_exists('apply_filters')) {
    /**
     * @param mixed $value
     * @param mixed ...$args
     * @return mixed
     */
    function apply_filters(string $hook, $value, ...$args)
    {
        foreach ($GLOBALS['wconvertTestFilters'][$hook] ?? [] as $callback) {
            $value = $callback($value, ...$args);
        }

        return $value;
    }
}

/*
 * The privacy-policy suggestion, recorded rather than performed.
 *
 * @var list<array{plugin: string, content: string}> $wconvertTestPolicyContent
 */
$GLOBALS['wconvertTestPolicyContent'] = [];

if (!function_exists('wp_add_privacy_policy_content')) {
    function wp_add_privacy_policy_content(string $pluginName, string $policyText): void
    {
        $GLOBALS['wconvertTestPolicyContent'][] = ['plugin' => $pluginName, 'content' => $policyText];
    }
}

if (!function_exists('esc_html')) {
    function esc_html(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES);
    }
}

if (!function_exists('esc_html__')) {
    function esc_html__(string $text, string $domain = 'default'): string
    {
        return htmlspecialchars($text, ENT_QUOTES);
    }
}

if (!function_exists('_n')) {
    function _n(string $single, string $plural, int $number, string $domain = 'default'): string
    {
        return $number === 1 ? $single : $plural;
    }
}

if (!function_exists('number_format_i18n')) {
    function number_format_i18n(float $number, int $decimals = 0): string
    {
        return number_format($number, $decimals);
    }
}

if (!function_exists('sanitize_text_field')) {
    function sanitize_text_field(string $value): string
    {
        return trim((string) preg_replace('/[\r\n\t]+|<[^>]*>/', '', $value));
    }
}

if (!function_exists('sanitize_email')) {
    function sanitize_email(string $email): string
    {
        return (string) filter_var(trim($email), FILTER_SANITIZE_EMAIL);
    }
}

/*
 * WP-Cron, recorded rather than performed.
 *
 * The retention pruner runs on a WordPress schedule, and "the job is
 * registered from day one and is a no-op with no period configured" is an
 * acceptance criterion about the REGISTRATION — which is invisible to any test
 * that calls the job directly.
 *
 * @var array<string, int> $wconvertTestSchedule
 */
$GLOBALS['wconvertTestSchedule'] = [];

if (!function_exists('wp_next_scheduled')) {
    /** @param array<mixed> $args */
    function wp_next_scheduled(string $hook, array $args = []): int|false
    {
        return $GLOBALS['wconvertTestSchedule'][$hook] ?? false;
    }
}

if (!function_exists('wp_schedule_event')) {
    /** @param array<mixed> $args */
    function wp_schedule_event(int $timestamp, string $recurrence, string $hook, array $args = []): bool
    {
        $GLOBALS['wconvertTestSchedule'][$hook] = $timestamp;

        return true;
    }
}

/*
 * `_doing_it_wrong()`, recorded rather than performed.
 *
 * It is WordPress's own channel for "a plugin called this wrong", and it is
 * where a registry says out loud that it refused an entry — a rejection is an
 * AUTHORING error, so it goes where an author is working rather than into an
 * admin notice a merchant cannot act on. The real function triggers a PHP
 * notice under `WP_DEBUG`, which PHPUnit would report as a failure on the
 * tests that deliberately register a bad entry; recording it instead is what
 * lets "not silent" be asserted rather than asserted-about.
 *
 * @var list<array{where: string, message: string}> $wconvertTestDoingItWrong
 */
$GLOBALS['wconvertTestDoingItWrong'] = [];

if (!function_exists('_doing_it_wrong')) {
    function _doing_it_wrong(string $function, string $message, string|false|null $version = null): void
    {
        $GLOBALS['wconvertTestDoingItWrong'][] = ['where' => $function, 'message' => $message];
    }
}

/*
 * The keyed hash core uses for its own flood control, and WConvert uses for
 * the beacon's rate limit.
 *
 * A fixed salt rather than a random one: the assertion that matters is that
 * the transient key is DERIVED from the address and does not CONTAIN it, and a
 * key that changed between two calls in one test would make that unassertable.
 * The real function is an HMAC on the site's own salts, which is what makes a
 * production key unreversible and uncorrelatable across sites.
 */
if (!function_exists('wp_hash')) {
    function wp_hash(string $data, string $scheme = 'auth'): string
    {
        return hash_hmac('md5', $data, 'wconvert-test-salt-' . $scheme);
    }
}

/*
 * The site's timezone — UTC here, like every other clock in this file.
 *
 * That is deliberate and it is also why NO test in this suite proves anything
 * about timezones through it. `stat_date` is the site's day rather than UTC's,
 * and a stub that answers UTC cannot tell the two apart — so the arithmetic
 * lives in `WConvert\Stats\StatDay::of()`, which takes the zone as an argument
 * and is proven against real non-UTC zones with no WordPress in sight, and the
 * one line that ASKS WordPress for the zone is proven against a real site's
 * `timezone_string` in `bin/verify-stats.php`.
 *
 * What this stub is for is the tests that must call through a code path
 * containing that line while asserting something else entirely — the beacon's
 * filtering, its rate limit, its published-set check.
 */
if (!function_exists('wp_timezone')) {
    function wp_timezone(): DateTimeZone
    {
        return new DateTimeZone('UTC');
    }
}

/*
 * `$wpdb`, as much of it as `WConvert\Database\WpdbConnection` touches.
 *
 * A class rather than a function stub because that class is PASSED IN — which
 * is the bootstrap's own rule about what may be stubbed, satisfied rather than
 * bent. It records what it was handed and performs nothing, so a test can
 * assert the thing no other test in this suite can see: what actually reached
 * `prepare()`, in the order it reached it.
 *
 * That is the shape of the bug #25 shipped. `prepare()` binds by APPEARANCE,
 * so a query naming its table twice and passing both tables in front of the
 * values filters on a table name and selects `FROM` an Optin id. It failed
 * loudly against a real database and silently against a fake that ignores SQL
 * text.
 */
if (!class_exists('wpdb')) {
    class wpdb
    {
        public string $prefix = 'wp_';

        public string $last_error = '';

        /** @var list<array{sql: string, args: list<mixed>}> */
        public array $prepared = [];

        /** @var list<string> */
        public array $queries = [];

        /**
         * @param mixed ...$args
         */
        public function prepare(string $query, ...$args): string
        {
            $this->prepared[] = ['sql' => $query, 'args' => array_values($args)];

            return $query;
        }

        public function query(string $sql): int
        {
            $this->queries[] = $sql;

            return 1;
        }

        /**
         * @return list<array<string, string|null>>
         */
        public function get_results(string $sql, string $output = 'OBJECT'): array
        {
            $this->queries[] = $sql;

            return [];
        }

        /**
         * @return array<string, string|null>|null
         */
        public function get_row(string $sql, string $output = 'OBJECT'): ?array
        {
            $this->queries[] = $sql;

            return null;
        }

        /**
         * @param array<string, mixed> $data
         */
        public function insert(string $table, array $data): int
        {
            return 1;
        }

        /**
         * @param array<string, mixed> $data
         * @param array<string, mixed> $where
         */
        public function update(string $table, array $data, array $where): int
        {
            return 1;
        }
    }
}

/*
 * `WP_REST_Response` and `WP_Error`, as much of each as a controller's return
 * value needs.
 *
 * Classes rather than function stubs, on the same footing as `wpdb` above and
 * for the same reason: they are what the code under test CONSTRUCTS, and there
 * is no way to pass a return type in. Every other Rest test in this suite
 * asserts on the REGISTRATION and never calls a callback, which is why nothing
 * needed these until a route had a payload worth asserting on — the
 * [[Destination]] read, whose guarantee is that a credential never appears in
 * it (#4).
 *
 * Deliberately minimal. A controller that needed more of WordPress's REST
 * layer than a status and a body is a controller with logic that should have
 * been somewhere testable.
 */
if (!class_exists('WP_REST_Response')) {
    class WP_REST_Response
    {
        /** @param mixed $data */
        public function __construct(private $data = null, private int $status = 200)
        {
        }

        /** @return mixed */
        public function get_data()
        {
            return $this->data;
        }

        public function get_status(): int
        {
            return $this->status;
        }
    }
}

if (!class_exists('WP_Error')) {
    class WP_Error
    {
        /** @param array<string, mixed> $data */
        public function __construct(
            private string $code = '',
            private string $message = '',
            private array $data = []
        ) {
        }

        public function get_error_code(): string
        {
            return $this->code;
        }

        public function get_error_message(): string
        {
            return $this->message;
        }

        /** @return array<string, mixed> */
        public function get_error_data(): array
        {
            return $this->data;
        }
    }
}

/*
 * The public post types, as objects with labels.
 *
 * `RuleCatalogue` resolves the options for a `post_type`-valued Targeting
 * rule from WordPress rather than from a list of ours, because a custom post
 * type's label is whatever its author registered. The two WordPress always has
 * are enough to prove the shape.
 */
if (!function_exists('get_post_types')) {
    /**
     * @param array<string, mixed> $args
     * @return array<string, object|string>
     */
    function get_post_types(array $args = [], string $output = 'names'): array
    {
        unset($args);

        if ($output !== 'objects') {
            return ['post' => 'post', 'page' => 'page'];
        }

        return [
            'post' => (object) ['labels' => (object) ['singular_name' => 'Post']],
            'page' => (object) ['labels' => (object) ['singular_name' => 'Page']],
        ];
    }
}
