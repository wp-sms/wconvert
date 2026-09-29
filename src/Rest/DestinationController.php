<?php

namespace WConvert\Rest;

use WConvert\Destination\BulkRePush;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\DestinationType;
use WConvert\Destination\DestinationUsage;
use WConvert\Destination\HealthStore;
use WConvert\Destination\MappingFields;
use WConvert\Destination\ConfiguredTarget;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushOutcome;
use WConvert\Destination\TestReport;
use WConvert\Lead\Identifier;
use WConvert\Support\DiagnosticSanitizer;
use WConvert\Support\Ulid;
use WConvert\Queue\RecentPushHistory;
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
        private readonly ?DestinationUsage $usage = null,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/connections', [
            ['methods' => 'POST', 'callback' => [$this, 'saveConnection'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/connections/' . self::ID_PATTERN, [
            ['methods' => 'DELETE', 'callback' => [$this, 'deleteConnection'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/connections/' . self::ID_PATTERN . '/check', [
            ['methods' => 'POST', 'callback' => [$this, 'checkConnection'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/destinations/schema', [
            ['methods' => 'GET', 'callback' => [$this, 'selectedSchema'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
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

        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/recent', [
            ['methods' => 'GET', 'callback' => [$this, 'recent'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/mapping-fields', [
            ['methods' => 'GET', 'callback' => [$this, 'mappingFields'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/draft-preview', [
            ['methods' => 'POST', 'callback' => [$this, 'draftPreview'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/destinations/' . self::ID_PATTERN . '/draft-test', [
            ['methods' => 'POST', 'callback' => [$this, 'draftTest'], 'permission_callback' => [Routes::class, 'canManage']],
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
                    // Explicit, never silently taken from the WordPress profile.
                    // Identifier::email validates the same value a capture uses;
                    // sanitizing first could turn a typo into another address.
                    'email' => ['type' => 'string'],
                    'interest' => ['type' => 'string'],
                ],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response([
            // A suggestion displayed before Send, not permission to send it.
            // The suggested sample contains email only. An interest value must
            // be entered explicitly; no answer, name or phone is fabricated.
            'test_sample' => [
                'email' => Identifier::email(wp_get_current_user()->user_email),
                'fields' => ['email'],
            ],
            'types' => array_values(array_map(
                fn (DestinationType $type): array => [
                    'id' => $type->id(),
                    'label' => $type->label(),
                    'icon' => $type->icon(),
                    'tier' => $type->tier()->value,
                    'requires' => $type->requires()?->value,
                    'availability' => $this->registry->availabilityOf($type->id())->value,
                    'needs_connection' => $type->connectionSchema() !== null,
                    'supports_mapping' => method_exists($type, 'mappingFields'),
                    'connection_schema' => $type->connectionSchema(),
                    'requirements' => $type->requirements()->toArray(),
                    // What a merchant is missing, in words. The enum's value
                    // is a slug — interpolating `wsms` into "Needs %s on this
                    // site" produces copy no merchant can act on, and a
                    // translator cannot fix it from their end either.
                    'requires_label' => $type->requires()?->label(),
                    // The fields this type offers, which is what removes the
                    // `Supports*` capability split: list discovery, custom
                    // fields and the configuration UI all fall out of one
                    // method (#4).
                    'settings_schema' => $type->connectionSchema() === null ? $this->safeSchema($type, null) : [],
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

    /** Metadata is loaded only for the account the merchant selected. */
    public function selectedSchema(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $type = $this->registry->find((string) $request->get_param('type'));
        if ($type === null) return $this->badConnection();
        $connection = $this->connections->find((string) $request->get_param('connection'));
        if ($type->connectionSchema() !== null && ($connection === null || $connection->type !== $type->id())) return $this->badConnection();
        try {
            return new WP_REST_Response(['settings_schema' => $this->schemaFor($type, $connection, $request->get_param('refresh') === '1')]);
        } catch (\Throwable $failure) {
            return new WP_Error('wconvert_metadata_unavailable', __('Could not load the selected account’s lists. Check the account and try again.', 'wconvert'), ['status' => 503]);
        }
    }

    /** Candidate credentials are checked before replacing a working key. */
    public function saveConnection(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = self::optionalString($request->get_param('id'));
        $existing = $id === null ? null : $this->connections->find($id);
        if ($id !== null && $existing === null) return $this->badConnection();
        $typeId = $existing === null ? (string) $request->get_param('type') : $existing->type;
        $type = $this->registry->find($typeId);
        if ($type === null || $type->connectionSchema() === null || !$this->registry->isDispatchable($typeId)) return $this->badConnection();
        if ($existing !== null && array_key_exists('type', $request->get_params()) && $request->get_param('type') !== $typeId) return $this->badConnection();
        $incoming = $request->get_param('credentials');
        if (!is_array($incoming)) $incoming = [];
        $credentials = $existing === null ? [] : $existing->credentials;
        foreach ($type->connectionSchema() as $key => $field) {
            if (!array_key_exists($key, $incoming)) continue;
            $value = $incoming[$key];
            if (!is_string($value) || trim($value) === '' || str_contains($value, '•')) return $this->badConnection();
            $credentials[$key] = trim($value);
        }
        foreach (array_keys($type->connectionSchema()) as $key) {
            if (!isset($credentials[$key]) || $credentials[$key] === '') return $this->badConnection();
        }
        try {
            $type->testConnection($credentials);
            $identity = method_exists($type, 'accountIdentity') ? $type->accountIdentity($credentials) : null;
            if ($existing !== null && $credentials !== $existing->credentials) {
                if (!is_string($identity) || $identity === '' || !is_string($existing->accountIdentity) || !hash_equals($existing->accountIdentity, $identity)) {
                    return new WP_Error('wconvert_account_changed', __('This key belongs to a different or unverified account. Connect it as a new account instead.', 'wconvert'), ['status' => 409]);
                }
            }
        } catch (\Throwable $failure) {
            return new WP_Error('wconvert_connection_check_failed', __('The account check failed. Your saved credentials have not changed.', 'wconvert'), ['status' => 400]);
        }
        $label = self::named($request->get_param('label')) ?? ($existing === null ? $type->label() : $existing->label);
        $saved = $this->connections->save($id, $typeId, $label, $credentials, is_string($identity) ? $identity : null);
        return new WP_REST_Response(['connection' => $saved->masked()]);
    }

    public function checkConnection(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $connection = $this->connections->find((string) $request->get_param('id'));
        if ($connection === null) return $this->badConnection();
        $type = $this->registry->find($connection->type);
        if ($type === null) return $this->badConnection();
        try {
            $type->testConnection($connection->credentials);
            $this->connections->recordCheck($connection->id, true);
            return new WP_REST_Response(['outcome' => 'success', 'message' => __('Account and audience access checked.', 'wconvert')]);
        } catch (\Throwable $failure) {
            $this->connections->recordCheck($connection->id, false);
            return new WP_REST_Response(['outcome' => 'failed', 'message' => __('Account check failed. Check the key and provider access.', 'wconvert')]);
        }
    }

    public function deleteConnection(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = (string) $request->get_param('id');
        foreach ($this->destinations->all() as $destination) {
            if ($destination->connectionId === $id) {
                return new WP_Error('wconvert_connection_in_use', __('This account is used by a destination. Reassign or remove that destination first.', 'wconvert'), ['status' => 409]);
            }
        }
        if (!$this->connections->delete($id)) return $this->badConnection();
        return new WP_REST_Response(['deleted' => true]);
    }

    private function badConnection(): WP_Error
    {
        return new WP_Error('wconvert_invalid_connection', __('Choose a valid account for this service.', 'wconvert'), ['status' => 400]);
    }

    /** A failed provider metadata read must not break all other integrations. */
    /** @return array<string, mixed> */
    private function safeSchema(DestinationType $type, ?\WConvert\Destination\Connection $connection): array
    {
        try { return $this->schemaFor($type, $connection); } catch (\Throwable $failure) { return []; }
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

        $connectionId = self::optionalString($connection);
        if ($registered->connectionSchema() !== null) {
            $account = $connectionId === null ? null : $this->connections->find($connectionId);
            if ($account === null || $account->type !== $type) return $this->badConnection();
        } elseif ($connectionId !== null) {
            return $this->badConnection();
        }
        $id = self::optionalString($request->get_param('id'));
        if ($id !== null && ($this->destinations->find($id)?->type !== $type)) {
            return new WP_Error('wconvert_invalid_destination', __('This destination cannot change its service.', 'wconvert'), ['status' => 400]);
        }

        $this->destinations->save(
            $id,
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

    public function recent(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = (string) $request->get_param('id');
        if ($this->destinations->find($id) === null) return $this->gone();
        return new WP_REST_Response(['attempts' => RecentPushHistory::recent($id)]);
    }

    public function mappingFields(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $destination = $this->destinations->find((string) $request->get_param('id'));
        if ($destination === null) return $this->gone();
        $type = $this->registry->find($destination->type);
        if ($type === null || !method_exists($type, 'mappingFields')) return new WP_REST_Response(['fields' => []]);
        try {
            return new WP_REST_Response(['fields' => $this->fieldsFor($destination, $type, $request->get_param('refresh') === '1')]);
        } catch (\Throwable $failure) {
            return new WP_Error('wconvert_mapping_fields_unavailable', __('Could not load this destination’s fields. Check its account and target.', 'wconvert'), ['status' => 503]);
        }
    }

    /** Preview is a server-validated projection and creates no Contact. */
    public function draftPreview(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $mapped = $this->draftMapped($request);
        if ($mapped instanceof WP_Error) return $mapped;
        return new WP_REST_Response(['email' => Identifier::email((string) $request->get_param('email')), 'mapped' => $mapped]);
    }

    /** Explicit sample send through the same adapter, with no Lead or queue job. */
    public function draftTest(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $mapped = $this->draftMapped($request);
        if ($mapped instanceof WP_Error) return $mapped;
        $destination = $this->destinations->find((string) $request->get_param('id'));
        if ($destination === null) return $this->gone();
        $email = Identifier::email((string) $request->get_param('email'));
        if ($email === null) return new WP_Error('wconvert_invalid_sample', __('Enter a valid test email address.', 'wconvert'), ['status' => 400]);
        $result = $this->dispatcher->test($destination->id, ['email' => $email], $mapped);
        return $this->reported(TestReport::of($result, $destination->label,
            $result->outcome === PushOutcome::Success ? ($this->targetOf($destination) ?? '') : ''),
            ['email' => $email, ...$mapped], $this->connections->credentialsFor($destination));
    }

    /** @return array<string, string>|WP_Error */
    private function draftMapped(WP_REST_Request $request): array|WP_Error
    {
        $destination = $this->destinations->find((string) $request->get_param('id'));
        if ($destination === null) return $this->gone();
        $email = Identifier::email((string) $request->get_param('email'));
        if ($email === null) return new WP_Error('wconvert_invalid_sample', __('Enter a valid test email address.', 'wconvert'), ['status' => 400]);
        $mapping = $request->get_param('mapping');
        $sample = $request->get_param('sample');
        if (!is_array($mapping) || !is_array($sample) || count($mapping) > 32) return new WP_Error('wconvert_invalid_sample', __('Check the draft mapping and sample values.', 'wconvert'), ['status' => 400]);
        $type = $this->registry->find($destination->type);
        if ($type === null || !method_exists($type, 'mappingFields')) return new WP_Error('wconvert_invalid_sample', __('This destination has no extra fields.', 'wconvert'), ['status' => 400]);
        try {
            $fields = $this->fieldsFor($destination, $type);
        } catch (\Throwable $failure) {
            return new WP_Error('wconvert_mapping_fields_unavailable', __('Could not check this destination’s fields.', 'wconvert'), ['status' => 503]);
        }
        $allowed = array_column($fields, 'value');
        $mapped = [];
        foreach ($mapping as $source => $target) {
            if (!is_string($source) || !is_string($target) || !in_array($target, $allowed, true) || isset($mapped[$target])) {
                return new WP_Error('wconvert_invalid_mapping', __('Choose one available destination field for each answer.', 'wconvert'), ['status' => 400]);
            }
            $value = $sample[$source] ?? null;
            if (!is_string($value) || mb_strlen($value) > 500) return new WP_Error('wconvert_invalid_sample', __('Enter a short sample for every mapped answer.', 'wconvert'), ['status' => 400]);
            if (trim($value) !== '') $mapped[$target] = trim($value);
        }
        return $mapped;
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

        $credentials = $this->connections->credentialsFor($destination);

        try {
            $type->testConnection($credentials);
        } catch (\Throwable $refused) {
            // Keep the provider's actionable wording. `reported()` removes
            // configured secrets before React renders the answer.
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- rendered through React, which escapes; see WpWsmsContacts::call().
            return $this->reported(TestReport::failed($refused->getMessage()), [], $credentials);
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
     * The merchant reviews the sample address and saved route before sending.
     * The profile is a visible suggestion on the read payload, never an implicit
     * recipient here. The same identifier normalizer as capture validates it;
     * the existing provider still decides whether the push can succeed.
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

        $email = Identifier::email(self::optionalString($request->get_param('email')) ?? '');

        if ($email === null) {
            return $this->reported(TestReport::failed(
                __('Enter a valid email address for this test. Nothing has been sent.', 'wconvert')
            ));
        }

        $sample = ['email' => $email];
        $interest = $request->get_param('interest');
        if ($interest !== null) {
            if (!is_string($interest) || trim($interest) === '') {
                return $this->reported(TestReport::failed(__('Enter an interest value or leave it out of the test. Nothing has been sent.', 'wconvert')));
            }
            $sample['interest'] = trim($interest);
        }
        $result = $this->dispatcher->test($destination->id, $sample);

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
        ), $sample, $this->connections->credentialsFor($destination));

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
            // Resolve options using this Destination's own Connection.
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

    /**
     * @param array<mixed> $personal
     * @param array<mixed> $secrets
     */
    private function reported(TestReport $report, array $personal = [], array $secrets = []): WP_REST_Response
    {
        $payload = $report->toArray();
        $payload['message'] = DiagnosticSanitizer::message($payload['message'], $personal, $secrets);

        return new WP_REST_Response($payload);
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
     * One type's settings schema, **read once per request per account.**
     *
     * ========================================================================
     * THE MEMO IS THE POINT, NOT AN OPTIMISATION.
     * ========================================================================
     * `settingsSchema()` may reach the provider. Remote schemas are loaded on
     * demand for the selected Connection; configured target labels reuse the
     * same request-local read for routes sharing that account.
     *
     * **Keyed by the Connection**, because the Connection is what changes the
     * answer: two Destinations over one key read one schema, and two ACCOUNTS
     * are two keys and two schemas whose id→label maps disagree. A type with
     * no Connection is keyed by the type instead, under a prefix no ULID can
     * collide with.
     *
     * A failed read is remembered too. Callers turn it into a local error or
     * an absent target label without failing the entire destinations page.
     *
     * @return array<string, mixed>
     */
    private function schemaFor(DestinationType $type, ?\WConvert\Destination\Connection $connection, bool $refresh = false): array
    {
        $key = $connection === null ? 'type:' . $type->id() : $connection->id;

        if ($refresh || !array_key_exists($key, $this->schemas)) {
            try {
                $cacheKey = $connection === null ? null : $this->metadataKey('schema', $type, $connection);
                $cached = !$refresh && $cacheKey !== null && function_exists('get_transient') ? get_transient($cacheKey) : false;
                $schema = is_array($cached) ? $cached : $type->settingsSchema($connection === null ? [] : $connection->credentials);
                if ($cacheKey !== null && !is_array($cached) && function_exists('set_transient')) set_transient($cacheKey, $schema, 300);
                $this->schemas[$key] = $schema;
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

    /** @return list<array{value: string, label: string}> */
    private function fieldsFor(\WConvert\Destination\Destination $destination, DestinationType $type, bool $refresh = false): array
    {
        return MappingFields::for($type, $destination, $this->connections->credentialsFor($destination), $refresh);
    }

    /** Opaque cache key changes when credentials or the selected target change. */
    /** @param array<string, mixed> $settings */
    private function metadataKey(string $kind, DestinationType $type, \WConvert\Destination\Connection $connection, array $settings = []): string
    {
        return 'wconvert_meta_' . substr(hash('sha256', (string) wp_json_encode([$kind, $type->id(), $connection->id,
            $connection->credentials, $settings])), 0, 40);
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
        $usage = $this->usage?->all();
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
                'requirements' => $this->registry->find($destination->type)?->requirements()->toArray(),
                'mapping_issues' => $this->mappingIssues($destination),
                'usage' => $usage === null ? null : ($usage[$destination->id] ?? []),
            ];
        }

        return $rows;
    }

    /** @return list<string> */
    private function mappingIssues(\WConvert\Destination\Destination $destination): array
    {
        $type = $this->registry->find($destination->type);
        if ($type === null) return [];
        $issues = [];
        foreach ($type->requirements()->mappedFields as $field) {
            $selected = \WConvert\Destination\DestinationRequirements::text($destination->settings[$field['setting']] ?? null);
            if ($selected === '') continue;
            try {
                $schema = $this->schemaFor($type, $destination->connectionId === null ? null : $this->connections->find($destination->connectionId));
                $options = $schema[$field['setting']]['options'] ?? [];
                if (!is_array($options) || !in_array($selected, array_column($options, 'value'), true)) {
                    $issues[] = sprintf(__('The selected field for %s is unavailable. Review this destination’s mapping.', 'wconvert'), $field['label']);
                }
            } catch (\Throwable $failure) {
                $issues[] = __('The provider fields could not be checked. Refresh before relying on the answer mapping.', 'wconvert');
            }
        }
        return $issues;
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
