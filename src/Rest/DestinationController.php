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
                    'settings_schema' => $type->settingsSchema(
                        $this->credentialsForType($type->id())
                    ),
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

        if ($this->registry->find($type) === null) {
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
            (string) ($request->get_param('label') ?? ''),
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
            $result->outcome === PushOutcome::Success ? $this->targetOf($destination) : ''
        ));

    }

    /**
     * What this Destination is pointed at, for the success sentence.
     *
     * **Guarded, because reading a schema can reach the wire.** An ESP's
     * options come off the provider ({@see DestinationType::settingsSchema()}),
     * so a provider having a bad time here would turn a push that LANDED into
     * a 500 — an error naming no door, on the screen whose whole job is to say
     * whether things are working (ADR 0042). A test that worked says so with
     * the shorter sentence.
     */
    private function targetOf(\WConvert\Destination\Destination $destination): string
    {
        $type = $this->registry->find($destination->type);

        if ($type === null) {
            return '';
        }

        try {
            // **This Destination's own Connection**, never the type's first.
            // `credentialsForType()` answers a question about the TYPE — which
            // is right for the schema on the Destinations read, where there is
            // no Destination yet — and wrong here: two Mailchimp audiences are
            // two Destinations over one Connection, but two ACCOUNTS are two
            // Connections, and the first one's id→label map names the wrong
            // audience.
            $schema = $type->settingsSchema($this->connections->credentialsFor($destination));
        } catch (\Throwable $unreachable) {
            unset($unreachable);

            return '';
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
     * The credentials a type's settings schema may need to read its options
     * off the wire.
     *
     * The FIRST Connection for the type, because a schema describes the type
     * rather than one configured Destination — and a type with no Connection
     * at all gets `[]`, which is every free type.
     *
     * @return array<string, mixed>
     */
    private function credentialsForType(string $typeId): array
    {
        foreach ($this->connections->all() as $connection) {
            if ($connection->type === $typeId) {
                return $connection->credentials;
            }
        }

        return [];
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
}
