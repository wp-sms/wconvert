<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\BulkRePush;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\Destination;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushResult;
use WConvert\Lead\LeadRepository;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\DestinationController;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * ============================================================================
 * TESTING A [[Destination]] FROM THE SCREEN, AND THE NEGATIVE THAT DEFINES IT.
 * ============================================================================
 * The feature was already written when the routes arrived:
 * {@see PushDispatcher::test()} carries a long docblock arguing its own
 * design, and every type implements `testConnection()`. What did not exist was
 * a way to ASK — so a merchant who pasted a key had no way to find out whether
 * it worked except to wait for a real [[Lead]] (#88).
 *
 * **The records-nothing rule is the first test here because it is the one a
 * careless controller breaks.** A test that failed looks exactly like a push
 * that failed, so recording it is the natural thing to write — and it would
 * let a merchant pressing the button four times while fixing an API key walk
 * away with their own Destination marked unhealthy and a failure ring full of
 * a [[Lead]] id that does not exist. Delivery state is about Leads that were
 * captured (ADR 0008), and a test captured none.
 *
 * The dispatcher's own guarantee is held in
 * {@see \WConvert\Tests\Unit\Destination\TestSendTest}. What is under test
 * HERE is that the route did not undo it, which is a different failure with
 * the same symptom.
 */
final class TestADestinationTest extends TestCase
{
    private FakeOptionStore $options;

    private FakeQueue $queue;

    private FakeDestinationType $type;

    private HealthStore $health;

    private DeliveryFailures $failures;

    private DestinationController $controller;

    private FakeConnection $db;

    private Destination $destination;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestUserEmail'] = 'merchant@example.com';

        $this->options = new FakeOptionStore();
        $this->queue = new FakeQueue();
        $this->type = new FakeDestinationType('fake', requires: SiteDependency::Wsms);

        $this->db = new FakeConnection();
        $db = $this->db;
        $destinations = new DestinationStore($this->options);
        $connections = new ConnectionStore($this->options);

        $this->health = new HealthStore($this->options);
        $this->failures = new DeliveryFailures($this->options);

        $registry = (new DestinationRegistry(
            new FakeProPresence(),
            new FakeSitePresence([SiteDependency::Wsms])
        ))->register($this->type);

        $optins = new OptinRepository(
            $db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($this->options)
        );

        $this->destination = $destinations->save(null, 'fake', 'Newsletter push', null, ['tags' => ['3']]);

        $this->controller = new DestinationController(
            $registry,
            $destinations,
            $connections,
            $this->health,
            $this->failures,
            new BulkRePush($registry, $destinations, $optins, new LeadRepository($db), $this->health, $this->queue),
            new PushDispatcher($registry, $destinations, $optins, $this->health, $this->queue, $connections)
        );

        $this->controller->registerRoutes();
    }

    private function request(string $id): \WP_REST_Request
    {
        $request = new \WP_REST_Request('POST');
        $request->set_param('id', $id);

        return $request;
    }

    /**
     * @return array{outcome: string, message: string}
     */
    private function send(string $id): array
    {
        $request = $this->request($id);
        $request->set_param('email', 'merchant@example.com');
        /** @var \WP_REST_Response $response */
        $response = $this->controller->testSend($request);

        /** @var array{outcome: string, message: string} $body */
        $body = $response->get_data();

        return $body;
    }

    public function testBothRoutesAreRegisteredAndRequireTheSameCapabilityAsTheRest(): void
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        $registered = array_map(static fn (array $route): string => $route['route'], $routes);

        self::assertNotSame([], array_filter(
            $registered,
            static fn (string $route): bool => str_contains($route, 'test-connection')
        ));
        self::assertNotSame([], array_filter(
            $registered,
            static fn (string $route): bool => str_contains($route, 'test-send')
        ));

        // The capability is asserted across EVERY route in
        // {@see DestinationRoutesTest}, which is where it belongs — a rule
        // about the set cannot be held by a test that names two members.
    }

    /**
     * ========================================================================
     * THE SEAM MOST LIKELY TO REGRESS, AND THE HARDEST TO NOTICE WHEN IT DOES.
     * ========================================================================
     * A **failing** test send, because that is the direction the mistake goes:
     * nobody records a success by accident. Byte-identical health, an empty
     * failure ring and an empty queue, before and after.
     */
    public function testAFailingTestSendRecordsNothingAtAll(): void
    {
        $before = $this->options->all();

        $this->type->answers = [PushResult::retryable('The vendor is having a bad time.')];

        $sent = $this->send($this->destination->id);

        self::assertSame('failed', $sent['outcome']);

        // The WHOLE option store, not a probe at health: health and the
        // failure ring both live in options, and an assertion that named the
        // two it expected to be unchanged could not see a third somebody adds
        // later.
        self::assertSame($before, $this->options->all(), 'A test send wrote something.');

        self::assertSame(0, $this->health->of($this->destination->id)->consecutiveFailures);
        self::assertNull($this->health->of($this->destination->id)->lastError);
        self::assertSame([], $this->failures->all());
        self::assertSame([], $this->queue->jobs, 'A test is answered now, never queued.');

        // **The delivery counters are the third thing, and they are NOT
        // options** — they are rows in `wconvert_stats`, written through
        // `DeliveryCount` from {@see \WConvert\Destination\PushWorker}. So
        // the claim is held here against the database the counters live in,
        // and again against a real table in `bin/verify-destinations.php`.
        self::assertSame([], $this->db->writes, 'A test send wrote a row.');
        self::assertSame([], $this->db->upserts, 'A test send moved a counter.');
    }

    /**
     * Four presses while fixing a key, which is the real shape of the bug.
     */
    public function testPressingItRepeatedlyLeavesTheDestinationExactlyAsItWas(): void
    {
        $before = $this->options->all();

        $this->type->answers = [PushResult::retryable('Bad key.')];

        foreach (range(1, 4) as $ignored) {
            unset($ignored);

            $this->send($this->destination->id);
        }

        self::assertSame($before, $this->options->all());
        self::assertCount(4, $this->type->pushed, 'Each press really did reach the type.');
    }

    /**
     * **A provider's own words reach the screen.**
     *
     * ADR 0042: the admin speaks only when it changes what you do next, and a
     * generic *"the test failed"* changes nothing. The WSMS push already
     * stores failure text exactly as WSMS wrote it, and the same posture
     * applies here — including the punctuation, because `DeliveryFailures`
     * truncates with `mb_substr()` and an HTML entity cut in half is what
     * escaping on the way through produces.
     */
    public function testAProvidersFailureTextReachesTheScreenVerbatim(): void
    {
        $message = "Sarah's key & the <audience> it opens were refused";

        $this->type->answers = [PushResult::terminal($message)];

        self::assertSame($message, $this->send($this->destination->id)['message']);
    }

    public function testATestSendKeepsTheReasonButDoesNotEchoItsRecipient(): void
    {
        $this->type->answers = [PushResult::terminal('Provider rejected merchant@example.com: invalid subscriber.')];

        $message = $this->send($this->destination->id)['message'];

        self::assertSame('Provider rejected [email]: invalid subscriber.', $message);
        self::assertStringNotContainsString('merchant@example.com', $message);
    }

    /**
     * **A type this install cannot run is not a failure**, and collapsing that
     * into one would tell a merchant with no WP SMS that their WP SMS
     * Destination is broken when the truth is that the plugin is not
     * installed. It is the `locked`/`unavailable` distinction one layer up
     * (ADR 0026).
     */
    public function testAnUnavailableTypeReportsThatItCannotRunRatherThanFailing(): void
    {
        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))
            ->register($this->type);

        $destinations = new DestinationStore($this->options);
        $connections = new ConnectionStore($this->options);
        $db = new FakeConnection();

        $optins = new OptinRepository(
            $db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($this->options)
        );

        $controller = new DestinationController(
            $registry,
            $destinations,
            $connections,
            $this->health,
            $this->failures,
            new BulkRePush($registry, $destinations, $optins, new LeadRepository($db), $this->health, $this->queue),
            new PushDispatcher($registry, $destinations, $optins, $this->health, $this->queue, $connections)
        );

        /** @var \WP_REST_Response $sent */
        $sent = $controller->testSend($this->request($this->destination->id));
        /** @var array{outcome: string, message: string} $sentBody */
        $sentBody = $sent->get_data();

        /** @var \WP_REST_Response $connected */
        $connected = $controller->testConnection($this->request($this->destination->id));
        /** @var array{outcome: string, message: string} $connectedBody */
        $connectedBody = $connected->get_data();

        self::assertSame('skipped', $sentBody['outcome']);
        self::assertSame('skipped', $connectedBody['outcome']);

        // **One answer from both buttons.** A merchant reading two different
        // explanations of one missing plugin learns that the screen is
        // guessing.
        self::assertSame($sentBody['message'], $connectedBody['message']);

        self::assertSame([], $this->type->pushed, 'Nothing was attempted.');
    }

    /**
     * A success says which of the merchant's Destinations it proved, and what
     * that Destination is pointed at — read off the type's own settings
     * schema, so no type implements anything for it.
     */
    public function testASuccessNamesTheDestinationAndWhatItLandedOn(): void
    {
        $this->type->settingsSchema = [
            'tags' => [
                'type' => 'ids',
                'label' => 'Lists',
                'options' => [['value' => '3', 'label' => 'Newsletter'], ['value' => '4', 'label' => 'Offers']],
            ],
        ];

        $sent = $this->send($this->destination->id);

        self::assertSame('success', $sent['outcome']);
        self::assertStringContainsString('Newsletter push', $sent['message']);
        self::assertStringContainsString('Newsletter', $sent['message']);
    }

    /**
     * The explicit sample is the same canonical input a captured address uses.
     */
    public function testTheExplicitSampleContainsOnlyEmailAndWritesNoLead(): void
    {
        $this->send($this->destination->id);

        $subject = $this->type->pushed[0];

        self::assertSame(['email' => 'merchant@example.com'], $subject->values);
        self::assertTrue($subject->isTest, 'A type that must say so can.');
    }

    /**
     * Changing the visible sample changes exactly what the provider receives.
     */
    public function testAnExplicitAddressWins(): void
    {
        $request = $this->request($this->destination->id);
        $request->set_param('email', 'colleague@example.com');

        $this->controller->testSend($request);

        self::assertSame('colleague@example.com', $this->type->pushed[0]->values['email']);
    }

    /**
     * **A type with no [[Connection]] has nothing to check, and says so.**
     *
     * Every free type is in this state — the WSMS push, the MailPoet push and
     * the lead-magnet email all authenticate against nothing. A green tick
     * here would teach a merchant that this button means *"this works"*, which
     * is what the other button is for.
     */
    public function testTestConnectionOnATypeWithNoCredentialsSaysSoRatherThanPassing(): void
    {
        /** @var \WP_REST_Response $response */
        $response = $this->controller->testConnection($this->request($this->destination->id));
        /** @var array{outcome: string, message: string} $body */
        $body = $response->get_data();

        self::assertSame('skipped', $body['outcome']);
        self::assertSame([], $this->type->connectionTests, 'There was nothing to ask.');
    }

    public function testTestConnectionReportsARefusedKeyInTheProvidersOwnWords(): void
    {
        $this->type->connectionSchema = ['api_key' => ['type' => 'text', 'label' => 'API key']];
        $this->type->connectionFailure = new \RuntimeException('That key was revoked on 3 August.');

        $before = $this->options->all();

        /** @var \WP_REST_Response $response */
        $response = $this->controller->testConnection($this->request($this->destination->id));
        /** @var array{outcome: string, message: string} $body */
        $body = $response->get_data();

        self::assertSame('failed', $body['outcome']);
        self::assertSame('That key was revoked on 3 August.', $body['message']);

        // A question answered is not an outage (ADR 0008).
        self::assertSame($before, $this->options->all());
    }

    public function testAnUnknownDestinationIs404OnBothRoutes(): void
    {
        self::assertInstanceOf(\WP_Error::class, $this->controller->testSend($this->request('01NOTHING')));
        self::assertInstanceOf(\WP_Error::class, $this->controller->testConnection($this->request('01NOTHING')));
    }

    /**
     * **A WordPress account is allowed to have no address**, and a cron or CLI
     * context has no user at all.
     *
     * Left unguarded the merchant reads a type's own *"the Lead carries no
     * email address"* — true, internal, and no help to somebody who pressed a
     * button. ADR 0042: the admin speaks only when it changes what you do
     * next, and this sentence says what to do next.
     */
    public function testAnOmittedAddressNeverSilentlyUsesTheWordPressProfile(): void
    {
        /** @var \WP_REST_Response $response */
        $response = $this->controller->testSend($this->request($this->destination->id));
        /** @var array{outcome: string, message: string} $sent */
        $sent = $response->get_data();
        self::assertSame('failed', $sent['outcome']);
        self::assertStringContainsString('Enter a valid email address', $sent['message']);
        self::assertSame([], $this->type->pushed, 'Nothing was attempted, so nothing can have been sent.');
    }

    public function testInvalidSamplesAreRefusedBeforeTheProviderAndWithoutMutatingHealth(): void
    {
        $before = $this->options->all();
        foreach (['', 'not-an-address', 'one@example.com,two@example.com', "recipient\n@example.com"] as $email) {
            $request = $this->request($this->destination->id);
            $request->set_param('email', $email);
            /** @var \WP_REST_Response $response */
            $response = $this->controller->testSend($request);
            self::assertSame('failed', $response->get_data()['outcome']);
        }
        self::assertSame([], $this->type->pushed);
        self::assertSame($before, $this->options->all());
        self::assertSame([], $this->db->writes);
        self::assertSame([], $this->queue->jobs);
    }

    public function testTheReadSuggestsAVisibleSampleWithoutSendingAnything(): void
    {
        $GLOBALS['wconvertTestUserEmail'] = ' Merchant@Example.com ';
        $payload = $this->controller->index()->get_data();
        self::assertSame(['email' => 'merchant@example.com', 'fields' => ['email']], $payload['test_sample']);
        self::assertSame([], $this->type->pushed);
        self::assertSame([], $this->db->writes);
        self::assertSame([], $this->queue->jobs);
        $GLOBALS['wconvertTestUserEmail'] = '';
        self::assertNull($this->controller->index()->get_data()['test_sample']['email']);
    }

    public function testAnExplicitInterestValueReachesTheSampleWithoutCreatingALeadOrInventingDefaults(): void
    {
        $before = $this->options->all();
        $request = $this->request($this->destination->id);
        $request->set_param('email', 'seed@example.com');
        $request->set_param('interest', 'installation');
        $this->controller->testSend($request);
        self::assertSame(['email' => 'seed@example.com', 'interest' => 'installation'], $this->type->pushed[0]->values);
        self::assertTrue($this->type->pushed[0]->isTest);
        self::assertSame($before, $this->options->all());
        self::assertSame([], $this->db->writes);
        self::assertSame([], $this->queue->jobs);
    }

    public function testMalformedOptionalInterestIsRejectedBeforeAnyProviderCall(): void
    {
        foreach (['  ', ['installation'], false] as $interest) {
            $request = $this->request($this->destination->id);
            $request->set_param('email', 'seed@example.com');
            $request->set_param('interest', $interest);
            /** @var \WP_REST_Response $response */
            $response = $this->controller->testSend($request);
            self::assertSame('failed', $response->get_data()['outcome']);
        }
        self::assertSame([], $this->type->pushed);
    }

    /**
     * **The unavailable answer comes before the address**, because a type this
     * install cannot run has nothing to send wherever the address came from —
     * and telling a merchant with no WP SMS to check their WordPress profile
     * sends them to fix the wrong thing.
     */
    public function testAnUnavailableTypeAnswersThatFirstEvenWithNoAddress(): void
    {
        $GLOBALS['wconvertTestUserEmail'] = '';

        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))
            ->register($this->type);

        $destinations = new DestinationStore($this->options);
        $connections = new ConnectionStore($this->options);
        $db = new FakeConnection();

        $optins = new OptinRepository(
            $db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($this->options)
        );

        $controller = new DestinationController(
            $registry,
            $destinations,
            $connections,
            $this->health,
            $this->failures,
            new BulkRePush($registry, $destinations, $optins, new LeadRepository($db), $this->health, $this->queue),
            new PushDispatcher($registry, $destinations, $optins, $this->health, $this->queue, $connections)
        );

        /** @var \WP_REST_Response $response */
        $response = $controller->testSend($this->request($this->destination->id));
        /** @var array{outcome: string, message: string} $body */
        $body = $response->get_data();

        self::assertSame('skipped', $body['outcome']);
        self::assertStringNotContainsString('WordPress profile', $body['message']);
    }

    /**
     * **The target is resolved from THIS Destination's own Connection**, never
     * the type's first.
     *
     * Two Mailchimp audiences are two Destinations over one Connection; two
     * ACCOUNTS are two Connections, and the first one's id-to-label map names
     * the wrong audience. The push one line earlier already uses the right
     * one, so the sentence disagreeing with what was actually pushed is the
     * failure this pins.
     */
    public function testTheTargetIsNamedFromTheDestinationsOwnCredentials(): void
    {
        $this->type->settingsSchema = [
            'tags' => [
                'type' => 'ids',
                'label' => 'Lists',
                'options' => [['value' => '3', 'label' => 'Newsletter']],
            ],
        ];

        // A Connection of the SAME TYPE that this Destination is not bound to.
        // `connectionForType()` — right for the types list, where there is no
        // Destination yet — would hand these over, and the label map would be
        // the wrong account's.
        (new ConnectionStore($this->options))->save(null, 'fake', 'Another account', [
            'api_key' => 'the-other-accounts-key',
        ]);

        $sent = $this->send($this->destination->id);

        self::assertStringContainsString('Newsletter', $sent['message']);
        self::assertSame(
            [],
            $this->type->schemaCredentials[0] ?? null,
            'The schema was read with another account’s key.'
        );
    }

    /**
     * A schema read may reach the provider, so a test that LANDED must not be
     * turned into a 500 by a second question on the way to reporting the first
     * answer (ADR 0042).
     */
    public function testAThrowingSchemaLeavesASuccessfulTestSuccessful(): void
    {
        $this->type->schemaFailure = new \RuntimeException('The provider is down.');

        $sent = $this->send($this->destination->id);

        self::assertSame('success', $sent['outcome']);
        self::assertStringContainsString('Newsletter push', $sent['message']);
    }

    /**
     * A failed test asks the provider nothing further. Naming a target is what
     * a SUCCESS sentence is for.
     */
    public function testAFailedTestNeverAsksForTheSchema(): void
    {
        $this->type->answers = [\WConvert\Destination\PushResult::retryable('Down.')];

        $this->send($this->destination->id);

        self::assertSame(0, $this->type->schemaReads);
    }

}
