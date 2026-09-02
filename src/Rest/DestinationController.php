<?php

namespace WConvert\Rest;

use WConvert\Destination\BulkRePush;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\DestinationType;
use WConvert\Destination\HealthStore;
use WConvert\Destination\ConfiguredTarget;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushOutcome;
use WConvert\Destination\TestReport;
use WConvert\Support\Ulid;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for [[Destination]]s: what types exist, what is configured, **whether
 * pushing is working**, and the one recovery action.
 *
 * The health half is the reason this route exists at all. A merchant whose API
 * key expired three days ago has no other way to find out: the [[Lead]]s are
 * in the log, the [[Optin]] is still converting, and nothing anywhere says the
 * pushes stopped. What they get here is per-Destination health, the terminal
 * failure ring, and a re-push button — never a per-Lead delivery column, which
 * is a number this system deliberately does not keep (ADR 0008).
 *
 * **Credentials are never returned.** Writes are accepted and reads hand back
 * {@see \WConvert\Destination\Connection::masked()}. That is the whole of the
 * protection around a key WordPress gives us nowhere safe to put (#4).
 *
 * @since 0.1.0
 */
final class DestinationController implements RestController
{
    private const ID_PATTERN = '(?P<id>' . Ulid::PATTERN . ')';

    /**
     * Settings schemas already read this request, keyed by Connection.
     *
     * @var array<string, array<string, mixed>|\Throwable>
     */
    private array $schemas = [];

    public function __construct(
        private readonly DestinationRegistry $registry,
        private readonly DestinationStore $destinations,
        private readonly ConnectionStore $connections,
        private readonly HealthStore $health,
        private readonly DeliveryFailures $failures,
        private readonly BulkRePush $rePush,
        private readonly PushDispatcher $dispatcher,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/destinations', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'store'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'id' => ['type' => 'string', 'pattern' => '^' . Ulid::PATTERN . '$'],
                    'type' => ['type' => 'string', 'required' => true],
                    'label' => ['type' => 'string'],
                    'connection' => ['type' => ['string', 'null']],
                    'settings' => ['type' => 'object'],
                ],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN, [
            [
                'methods' => 'DELETE',
                'callback' => [$this, 'destroy'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/repush', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'repush'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);

        // ====================================================================
        // TWO VERBS, NOT ONE, AND THE DIFFERENCE IS WORTH KEEPING.
        // ====================================================================
        // *Test connection* asks whether the credentials are good, and is the
        // useful thing on a [[Connection]] the merchant has just pasted a key
        // into. *Test send* pushes a synthetic subject through the whole path
        // and is the useful thing when the connection is fine and the [[Lead]]
        // is not arriving. Collapsing them leaves the second question
        // unanswerable, which is the one a support ticket is usually about.
        //
        // **Both are POST** even though neither writes anything WConvert
        // stores. They act on a remote system, they are not idempotent from
        // the merchant's point of view — a test send really does send — and a
        // GET that emails somebody is a GET a prefetcher can fire.
        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/test-connection', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'testConnection'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/test-send', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'testSend'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    // **One argument, and it is an override rather than the
                    // way in.** The address defaults to the pressing
                    // merchant's own, which is what the button sends with; this
                    // is how a colleague's inbox or a seed address is reached,
                    // and it is what lets `bin/verify-destinations.php` prove a
                    // real send on a request that has no user at all.
                    //
                    // There is no `phone`. A test proves the integration and
                    // an email does that for every type WConvert has; a second
                    // identifier nothing on the screen can supply would be a
                    // parameter with no caller and no test.
                    //
                    // Sanitised on the way in, as every string arg in this REST
                    // layer is. `format => email` is deliberately NOT declared:
                    // it would make WordPress reject the request outright, and
                    // what a merchant needs from a typo is the screen's own
                    // sentence rather than a 400 with a schema error in it
                    // (ADR 0042).
                    'email' => ['type' => 'string', 'sanitize_callback' => 'sanitize_email'],
                ],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response([
            'types' => array_values(array_map(
                fn (DestinationType $type): array => [
                    'id' => $type->id(),
                    'label' => $type->label(),
                    'icon' => $type->icon(),
                    'tier' => $type->tier()->value,
                    'requires' => $type->requires()?->value,
                    'availability' => $this->registry->availabilityOf($type->id())->value,
                    'needs_connection' => $type->connectionSchema() !== null,
                    // What a merchant is missing, in words. The enum's value
                    // is a slug — interpolating `wsms` into "Needs %s on this
                    // site" produces copy no merchant can act on, and a
                    // translator cannot fix it from their end either.
                    'requires_label' => $type->requires()?->label(),
                    // The fields this type offers, which is what removes the
                    // `Supports*` capability split: list discovery, custom
                    // fields and the configuration UI all fall out of one
                    // method (#4).
                    'settings_schema' => $this->schemaFor($type, $this->connectionForType($type->id())),
                ],
                $this->registry->all()
            )),
            'destinations' => $this->configured(),
            'connections' => array_values(array_map(
                static fn (\WConvert\Destination\Connection $connection): array => $connection->masked(),
                $this->connections->all()
            )),
            // The ring, which is the only place a Lead-specific terminal
            // failure is visible at all — health cannot see one, because a
            // malformed address is not an outage (ADR 0008).
            'failures' => $this->failures->all(),
        ]);
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function store(WP_REST_Request $request)
    {
        $type = (string) $request->get_param('type');
        $registered = $this->registry->find($type);

        if ($registered === null) {
            return new WP_Error(
                'wconvert_unknown_destination_type',
                __('That Destination type is not available on this site.', 'wconvert'),
                ['status' => 400]
            );
        }

        $settings = $request->get_param('settings');
        $connection = $request->get_param('connection');

        $this->destinations->save(
            self::optionalString($request->get_param('id')),
            $type,
            // **A route is named by the merchant, and a nameless one still
            // has to be findable.** Two MailPoet Destinations differ only in
            // what they point at, so the name is the thing a merchant reads
            // on the Optin tab — and an empty string there would render a
            // checkbox with no words beside it. The type's own label is what
            // the screen used to send for every Destination, so it is the
            // fallback rather than an invention.
            self::named($request->get_param('label')) ?? $registered->label(),
            self::optionalString($connection),
            is_array($settings) ? $settings : []
        );

        return new WP_REST_Response(['destinations' => $this->configured()]);
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function destroy(WP_REST_Request $request)
    {
        $id = (string) $request->get_param('id');

        if (!$this->destinations->delete($id)) {
            return new WP_Error(
                'wconvert_destination_not_found',
                __('That Destination no longer exists.', 'wconvert'),
                ['status' => 404]
            );
        }

        // Its health goes with it. Health keyed by an id nothing references is
        // a row that never goes away on a site that has reconfigured its
        // integrations a few times.
        $this->health->forget($id);

        return new WP_REST_Response(['destinations' => $this->configured()]);
    }

    /**
     * Replay every Lead for Optins bound to this Destination since its last
     * success — the one recovery action, and **merchant-driven, never
     * automatic** (ADR 0008).
     */
    public function repush(WP_REST_Request $request): WP_REST_Response
    {
        return new WP_REST_Response($this->rePush->run((string) $request->get_param('id'))->toArray());
    }

    /**
     * **Are these credentials good?**
     *
     * A different question from whether a push lands, and the useful one on a
     * Connection the merchant has just created — which is why it is a separate
     * button rather than a branch inside the other one.
     *
     * A type with no Connection says so rather than reporting success: every
     * free type is in that state, and a green tick there would teach a
     * merchant that this button means *"this works"* when the other button is
     * what means that.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function testConnection(WP_REST_Request $request)
    {
        $destination = $this->destinations->find((string) $request->get_param('id'));

        if ($destination === null) {
            return $this->gone();
        }

        $type = $this->registry->find($destination->type);

        if ($type === null || !$this->registry->isDispatchable($destination->type)) {
            // The same sentence a test send gets for the same situation, and
            // the same object producing it, so a merchant with no WP SMS reads
            // one answer from both buttons rather than two.
            return $this->reported(TestReport::unavailable());
        }

        if ($type->connectionSchema() === null) {
            return $this->reported(TestReport::nothingToConnectTo());
        }

        try {
            $type->testConnection($this->connections->credentialsFor($destination));
        } catch (\Throwable $refused) {
            // **The provider's own words**, and the escaping argument is the
            // one `WpWsmsContacts::call()` makes: this is stored and rendered
            // through React, which escapes on the way to the DOM, so
            // esc_html() here would put `&#039;` in front of an operator
            // instead of an apostrophe.
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- rendered through React, which escapes; see WpWsmsContacts::call().
            return $this->reported(TestReport::failed($refused->getMessage()));
        }

        return $this->reported(TestReport::connected($destination->label));
    }

    /**
     * **Push a synthetic subject through the real `push()`.**
     *
     * Through the REAL one, which is most of the point: a code path that
     * behaves differently under test proves the code path and not the
     * integration ({@see \WConvert\Destination\PushSubject}). What differs is
     * where the values came from, and nothing else.
     *
     * The address defaults to the logged-in administrator's own, because the
     * merchant pressing this is the person who should receive whatever it
     * sends — the lead-magnet email really does deliver — and asking them to
     * type it is a step with one correct answer. Where there is no address to
     * default to, this says so in its own words rather than passing a type's
     * internal reason up to somebody who pressed a button.
     *
     * It writes no [[Lead]], queues nothing, and moves no counter:
     * {@see PushDispatcher::test()} is where that is guaranteed, and this
     * route adds nothing that could undo it.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function testSend(WP_REST_Request $request)
    {
        $destination = $this->destinations->find((string) $request->get_param('id'));

        if ($destination === null) {
            return $this->gone();
        }

        // **Asked before the address**, because a type this install cannot run
        // has nothing to send wherever the address came from — and telling a
        // merchant with no WP SMS to check their WordPress profile would send
        // them to fix the wrong thing.
        if (!$this->registry->isDispatchable($destination->type)) {
            return $this->reported(TestReport::unavailable());
        }

        $email = self::optionalString($request->get_param('email'))
            ?? self::optionalString(wp_get_current_user()->user_email);

        if ($email === null) {
            // Asked and answered HERE rather than left to the type, which
            // would say *"the Lead carries no email address"* — true, internal,
            // and no help to somebody who pressed a button (ADR 0042).
            return $this->reported(TestReport::noAddress());
        }

        $result = $this->dispatcher->test($destination->id, ['email' => $email]);

        // **Only where it landed.** Naming a target is what a SUCCESS sentence
        // is for, and resolving one costs a schema read that may reach the
        // provider — so a Destination that is down is not asked a second
        // question on its way to reporting the first answer.
        return $this->reported(TestReport::of(
            $result,
            $destination->label,
            // `?? ''` and not a second sentence: a Destination that selects
            // nothing, and one whose provider could not be reached, both come
            // back null here — and {@see TestReport::of()} already says the
            // shorter *"the test reached X"* for an unnamed target.
            $result->outcome === PushOutcome::Success ? ($this->targetOf($destination) ?? '') : ''
        ));

    }

    /**
     * What this Destination is pointed at — for the success sentence, and for
     * the line under every Destination on both screens that render one.
     *
     * **Null is a real answer here, three times over.** Two of them are
     * {@see ConfiguredTarget}'s: a type that selects nothing, and a provider
     * whose options could not be enumerated. The third is this method's own,
     * and it is the reason the `catch` does not fall back to `''`: **a schema
     * read can reach the wire**, so an ESP having a bad time means we could
     * not LOOK — which is a different thing from looking and finding nothing
     * chosen. Saying *"not pointed at anything yet"* there would report a
     * fault against a Destination that is pushing perfectly well, on the
     * screen whose whole job is to say whether things are working (ADR 0042).
     *
     * It also keeps a push that LANDED from being turned into a 500 by a
     * second question asked on the way to reporting the first answer.
     */
    private function targetOf(\WConvert\Destination\Destination $destination): ?string
    {
        $type = $this->registry->find($destination->type);

        if ($type === null) {
            return null;
        }

        try {
            // **This Destination's own Connection**, never the type's first.
            // `connectionForType()` answers a question about the TYPE — which
            // is right for the schema on the Destinations read, where there is
            // no Destination yet — and wrong here: two Mailchimp audiences are
            // two Destinations over one Connection, but two ACCOUNTS are two
            // Connections, and the first one's id→label map names the wrong
            // audience.
            $schema = $this->schemaFor(
                $type,
                $destination->connectionId === null
                    ? null
                    : $this->connections->find($destination->connectionId)
            );
        } catch (\Throwable $unreachable) {
            unset($unreachable);

            return null;
        }

        return ConfiguredTarget::of($schema, $destination->settings);
    }

    private function reported(TestReport $report): WP_REST_Response
    {
        return new WP_REST_Response($report->toArray());
    }

    private function gone(): WP_Error
    {
        return new WP_Error(
            'wconvert_destination_not_found',
            __('That Destination no longer exists.', 'wconvert'),
            ['status' => 404]
        );
    }

    /**
     * The Connection a type's settings schema may need to read its options off
     * the wire.
     *
     * The FIRST one for the type, because a schema describes the type rather
     * than one configured Destination — and a type with no Connection at all
     * gets null, which is every free type.
     */
    private function connectionForType(string $typeId): ?\WConvert\Destination\Connection
    {
        foreach ($this->connections->all() as $connection) {
            if ($connection->type === $typeId) {
                return $connection;
            }
        }

        return null;
    }

    /**
     * One type's settings schema, **read once per request per account.**
     *
     * ========================================================================
     * THE MEMO IS THE POINT, NOT AN OPTIMISATION.
     * ========================================================================
     * `settingsSchema()` may reach the provider — that is how a Mailchimp
     * audience gets a NAME rather than an id — and this payload now asks for
     * it once per type and again once per configured Destination. A merchant
     * with five Mailchimp routes over one key would pay six round trips to
     * that provider on every load of the Destinations screen and every load of
     * the builder, for six identical answers.
     *
     * **Keyed by the Connection**, because the Connection is what changes the
     * answer: two Destinations over one key read one schema, and two ACCOUNTS
     * are two keys and two schemas whose id→label maps disagree. A type with
     * no Connection is keyed by the type instead, under a prefix no ULID can
     * collide with.
     *
     * A read that THREW is remembered as the throw and re-thrown, so a
     * provider that is down is asked once rather than once per Destination.
     * Re-thrown rather than swallowed because the two callers want opposite
     * things from a failure: {@see self::targetOf()} says nothing, and the
     * types list has always let it surface.
     *
     * @return array<string, mixed>
     */
    private function schemaFor(DestinationType $type, ?\WConvert\Destination\Connection $connection): array
    {
        $key = $connection === null ? 'type:' . $type->id() : $connection->id;

        if (!array_key_exists($key, $this->schemas)) {
            try {
                $this->schemas[$key] = $type->settingsSchema($connection === null ? [] : $connection->credentials);
            } catch (\Throwable $unreachable) {
                $this->schemas[$key] = $unreachable;
            }
        }

        $schema = $this->schemas[$key];

        if ($schema instanceof \Throwable) {
            throw $schema;
        }

        return $schema;
    }

    /**
     * Configured Destinations, each with the health beside it — which is the
     * only thing on this screen a merchant is actually looking for.
     *
     * @return list<array<string, mixed>>
     */
    private function configured(): array
    {
        $health = $this->health->all();
        $rows = [];

        foreach ($this->destinations->all() as $destination) {
            $rows[] = $destination->toArray() + [
                'id' => $destination->id,
                'availability' => $this->registry->availabilityOf($destination->type)->value,
                'health' => ($health[$destination->id] ?? new \WConvert\Destination\DestinationHealth())->toArray(),
                // **Derived, never stored and never posted back.** It is
                // computed HERE rather than in the browser because
                // {@see ConfiguredTarget} is the one spelling of the rule, and
                // because the client only has the per-TYPE schema — built
                // from the first Connection of that type, which names the
                // wrong audience for the second account (#35).
                'target' => $this->targetOf($destination),
            ];
        }

        return $rows;
    }

    /**
     * @param mixed $value
     */
    private static function optionalString($value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * A merchant's name for a route, or null where they gave none.
     *
     * Whitespace is none: a name made of spaces renders as a checkbox with
     * nothing beside it, which is the same failure as an empty one and arrives
     * by the same accident.
     *
     * @param mixed $value
     */
    private static function named($value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
