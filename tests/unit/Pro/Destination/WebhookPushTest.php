<?php

namespace WConvert\Tests\Unit\Pro\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConnectionRefused;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushOutcome;
use WConvert\Destination\PushSubject;
use WConvert\Lead\Lead;
use WConvert\Pro\Module\Destinations\WebhookDestinationType;
use WConvert\Pro\Module\Destinations\WebhookSignature;
use WConvert\Pro\Module\Destinations\WebhookUrlGuard;

/** A webhook POSTs one signed, documented payload per submission, and reads only the receiver's status. */
final class WebhookPushTest extends TestCase
{
    /** @var list<array{string, array<string, mixed>}> */
    private array $calls = [];

    private string $secret;

    protected function setUp(): void
    {
        $this->secret = WebhookSignature::secret();
        $this->reply(200);
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertHttpReply'], $GLOBALS['wconvertTestFilters'][WebhookDestinationType::ALLOW_PRIVATE_FILTER], $GLOBALS['wconvertTestQuery']['environment_type']);
    }

    private function reply(int|\WP_Error $answer): void
    {
        $this->calls = [];
        $GLOBALS['wconvertHttpReply'] = function (string $url, array $args) use ($answer) {
            $this->calls[] = [$url, $args];
            return $answer instanceof \WP_Error ? $answer : ['response' => ['code' => $answer], 'body' => 'receiver text never read'];
        };
    }

    private static function type(): WebhookDestinationType
    {
        return new WebhookDestinationType(new WebhookUrlGuard(static fn (string $host): array => [
            'hooks.zapier.com' => ['54.1.2.3'], 'localhost' => ['127.0.0.1']][$host] ?? []));
    }

    /** @param list<array{name: string, value: string}> $headers */
    private function context(string $url = 'https://hooks.zapier.com/hooks/catch/1/abc/', array $headers = []): PushContext
    {
        return new PushContext('Spring sale popup', [], ['url' => $url, 'signing_secret' => $this->secret, 'headers' => $headers], '01OPTIN', 'grow_email_list');
    }

    private static function captured(): PushSubject
    {
        $lead = new Lead('01LEAD000000000000000000AA', '01OPTIN', 'sarah@example.com', null, [], '2026-10-13 09:12:44',
            ['submissions' => ['primary' => ['accepted_at' => '2026-10-13T09:12:44Z', 'purpose' => 'email_marketing',
                'values' => ['email' => 'sarah@example.com', 'name' => 'Sarah Ö 👍', 'consent_text' => 'Email me.'],
                'question_answers' => [['id' => 'budget', 'question' => 'Budget?', 'type' => 'single', 'values' => ['mid'], 'labels' => ['1k–5k']]]]],
             'source' => ['page_url' => '/pricing', 'utm' => ['source' => 'fb', 'medium' => null, 'campaign' => null, 'term' => null, 'content' => null]]]);
        return PushSubject::of($lead->submission('primary'), '01ROUTE', 'primary', $lead);
    }

    /** @return array<string, string> */
    private function sentHeaders(int $call = 0): array
    {
        return $this->calls[$call][1]['headers'];
    }

    public function testTheReceiverGetsTheDocumentedPayloadSignedOverItsExactBytes(): void
    {
        $result = self::type()->push(self::captured(), $this->context());
        self::assertSame(PushOutcome::Success, $result->outcome);
        [$url, $args] = $this->calls[0];
        self::assertSame('https://hooks.zapier.com/hooks/catch/1/abc/', $url);
        self::assertSame(0, $args['redirection']);
        self::assertSame(10, $args['timeout']);
        self::assertTrue($args['sslverify']);
        $headers = $this->sentHeaders();
        self::assertSame('application/json', $headers['Content-Type']);
        self::assertSame('lead.captured', $headers['X-WConvert-Event']);
        self::assertSame(WebhookSignature::sign($this->secret, $headers['webhook-id'], (int) $headers['webhook-timestamp'], $args['body']), $headers['webhook-signature']);
        self::assertEqualsWithDelta(time(), (int) $headers['webhook-timestamp'], 2);

        $payload = json_decode($args['body'], true);
        self::assertSame($headers['webhook-id'], $payload['id']);
        self::assertSame(['id', 'type', 'version', 'timestamp', 'test', 'site', 'data'], array_keys($payload));
        self::assertSame(['lead.captured', 1, '2026-10-13T09:12:44Z', false], [$payload['type'], $payload['version'], $payload['timestamp'], $payload['test']]);
        self::assertSame(['url' => 'https://example.test', 'environment' => 'production'], $payload['site']);
        self::assertSame(['email' => 'sarah@example.com', 'phone' => null, 'name' => 'Sarah Ö 👍'], $payload['data']['contact']);
        self::assertStringContainsString('Sarah Ö 👍', $args['body'], 'Unicode is sent as itself.');
        self::assertSame(['budget' => ['question' => 'Budget?', 'answer' => '1k–5k']], $payload['data']['answers']);
        self::assertSame(['id' => '01OPTIN', 'name' => 'Spring sale popup', 'goal' => 'grow_email_list'], $payload['data']['campaign']);
        self::assertSame(['page_url' => '/pricing', 'utm' => ['source' => 'fb', 'medium' => null, 'campaign' => null, 'term' => null, 'content' => null]], $payload['data']['source']);
        self::assertSame(['purpose' => 'email_marketing', 'email' => ['text' => 'Email me.', 'accepted_at' => '2026-10-13T09:12:44Z'], 'sms' => null], $payload['data']['consent']);
        self::assertStringNotContainsString('ip', implode(',', array_keys($payload['data'])));
    }

    public function testEveryKeyIsPresentWhenTheSubmissionCarriesNothingOptional(): void
    {
        $lead = new Lead('01LEAD000000000000000000AB', '01OPTIN', null, '+12025550123', [], '2026-10-13 09:12:44');
        self::type()->push(PushSubject::of($lead, '01ROUTE'), $this->context());
        $data = json_decode($this->calls[0][1]['body'], true)['data'];
        self::assertSame(['email' => null, 'phone' => '+12025550123', 'name' => null], $data['contact']);
        self::assertStringContainsString('"answers":{}', $this->calls[0][1]['body']);
        self::assertSame(['page_url' => null, 'utm' => ['source' => null, 'medium' => null, 'campaign' => null, 'term' => null, 'content' => null]], $data['source']);
        self::assertArrayHasKey('interest', $data);
    }

    public function testARetryIsTheSameDeliveryWithAFreshSignature(): void
    {
        $type = self::type();
        $type->push(self::captured(), $this->context());
        $type->push(self::captured(), $this->context());
        self::assertSame($this->sentHeaders(0)['webhook-id'], $this->sentHeaders(1)['webhook-id']);
        self::assertSame(json_decode($this->calls[0][1]['body'], true)['id'], json_decode($this->calls[1][1]['body'], true)['id']);
    }

    public function testCustomHeadersAreSentButCannotReplaceTheSignatureOrFraming(): void
    {
        self::type()->push(self::captured(), $this->context(headers: [
            ['name' => 'x-make-apikey', 'value' => 'key-123'],
            ['name' => 'webhook-signature', 'value' => 'v1,forged'],
            ['name' => 'Content-Type', 'value' => 'text/plain'],
        ]));
        $headers = $this->sentHeaders();
        self::assertSame('key-123', $headers['x-make-apikey']);
        self::assertStringStartsNotWith('v1,forged', $headers['webhook-signature']);
        self::assertSame('application/json', $headers['Content-Type']);
        self::assertArrayNotHasKey('content-type', $headers);
    }

    public function testATestSendIsMarkedAndFullySampled(): void
    {
        self::type()->push(PushSubject::test(['email' => 'me@shop.example']), new PushContext(null, [], ['url' => 'https://hooks.zapier.com/x', 'signing_secret' => $this->secret]));
        $payload = json_decode($this->calls[0][1]['body'], true);
        self::assertTrue($payload['test']);
        self::assertSame('me@shop.example', $payload['data']['contact']['email']);
        self::assertNotContains(null, $payload['data']['contact']);
        self::assertNotContains(null, $payload['data']['campaign']);
    }

    public function testAStagingCopySaysWhatItIs(): void
    {
        $GLOBALS['wconvertTestQuery']['environment_type'] = 'staging';
        self::type()->push(self::captured(), $this->context());
        self::assertSame('staging', json_decode($this->calls[0][1]['body'], true)['site']['environment']);
    }

    public function testTheReceiversStatusDecidesTheOutcome(): void
    {
        $cases = [201 => 'success', 204 => 'success', 301 => 'attention', 302 => 'attention', 401 => 'attention', 403 => 'attention',
            404 => 'attention', 410 => 'attention', 408 => 'retry', 429 => 'retry', 500 => 'retry', 503 => 'retry', 400 => 'terminal', 422 => 'terminal'];
        foreach ($cases as $status => $expected) {
            $this->reply($status);
            $result = self::type()->push(self::captured(), $this->context());
            $actual = $result->outcome === PushOutcome::Success ? 'success' : ($result->needsAttention ? 'attention' : ($result->retryable ? 'retry' : 'terminal'));
            self::assertSame($expected, $actual, "HTTP {$status}");
            // A test send is never retried, and a queued one says so in its
            // own status; the reason is the same words for both (#358).
            self::assertStringNotContainsString('retry', strtolower((string) $result->reason), "HTTP {$status}");
        }
    }

    /** What the receiver answered and how long it took, for the test screen; a transport error has no status. */
    public function testTheResultCarriesTheReceiversStatusAndTime(): void
    {
        foreach ([204, 503] as $status) {
            $this->reply($status);
            $result = self::type()->push(self::captured(), $this->context());
            self::assertSame($status, $result->httpStatus);
            self::assertIsInt($result->durationMs);
            self::assertGreaterThanOrEqual(0, $result->durationMs);
        }
        $this->reply(new \WP_Error('http_request_failed', 'cURL error 28: Operation timed out'));
        $result = self::type()->push(self::captured(), $this->context());
        self::assertNull($result->httpStatus);
        self::assertIsInt($result->durationMs);
    }

    public function testABadCertificateNeedsTheMerchantAndATimeoutRetries(): void
    {
        $this->reply(new \WP_Error('http_request_failed', 'cURL error 60: SSL certificate problem: self-signed certificate'));
        self::assertTrue(self::type()->push(self::captured(), $this->context())->needsAttention);
        $this->reply(new \WP_Error('http_request_failed', 'cURL error 28: Operation timed out after 10001 milliseconds'));
        self::assertTrue(self::type()->push(self::captured(), $this->context())->retryable);
    }

    public function testAPrivateAddressIsRefusedAtSendTimeUnlessADeveloperAllowsIt(): void
    {
        $result = self::type()->push(self::captured(), $this->context('http://localhost:5678/webhook'));
        self::assertTrue($result->needsAttention);
        self::assertSame([], $this->calls, 'Nothing was sent.');

        $GLOBALS['wconvertTestFilters'][WebhookDestinationType::ALLOW_PRIVATE_FILTER] = [static fn (): bool => true];
        self::assertSame(PushOutcome::Success, self::type()->push(self::captured(), $this->context('http://localhost:5678/webhook'))->outcome);
    }

    public function testCheckingTheConnectionSendsNothing(): void
    {
        self::type()->testConnection(['url' => 'https://hooks.zapier.com/x', 'signing_secret' => $this->secret]);
        self::assertSame([], $this->calls);
        $this->expectException(ConnectionRefused::class);
        self::type()->testConnection(['url' => 'http://localhost/', 'signing_secret' => $this->secret]);
    }

    public function testItsAccountIsTheReceiversHost(): void
    {
        self::assertSame('hooks.zapier.com', self::type()->accountIdentity(['url' => 'https://Hooks.Zapier.com/hooks/catch/1/abc/']));
    }
}
