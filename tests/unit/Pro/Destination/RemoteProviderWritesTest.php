<?php

namespace {
    if (!function_exists('is_email')) {
        function is_email(string $value): bool { return filter_var($value, FILTER_VALIDATE_EMAIL) !== false; }
    }
    if (!function_exists('wp_remote_request')) {
        /** @param array<string, mixed> $args
         * @return array<string, mixed>
         */
        function wp_remote_request(string $url, array $args): array { return ($GLOBALS['wconvertHttpReply'])($url, $args); }
    }
    if (!function_exists('is_wp_error')) {
        function is_wp_error(mixed $value): bool { return false; }
    }
    if (!function_exists('wp_remote_retrieve_body')) {
        /** @param array<string, mixed> $response */
        function wp_remote_retrieve_body(array $response): string { return $response['body']; }
    }
    if (!function_exists('wp_remote_retrieve_response_code')) {
        /** @param array<string, mixed> $response */
        function wp_remote_retrieve_response_code(array $response): int { return $response['status']; }
    }
}

namespace WConvert\Tests\Unit\Pro\Destination {
    use PHPUnit\Framework\TestCase;
    use WConvert\Destination\PushContext;
    use WConvert\Destination\PushOutcome;
    use WConvert\Destination\PushSubject;
    use WConvert\Pro\Module\Destinations\BrevoDestinationType;
    use WConvert\Pro\Module\Destinations\MailchimpDestinationType;

    final class RemoteProviderWritesTest extends TestCase
    {
        /** @var list<array{string, array<string, mixed>}> */
        private array $calls = [];

        /** @param list<array{int, array<string, mixed>}> $statuses */
        private function reply(array $statuses): void
        {
            $this->calls = [];
            $GLOBALS['wconvertHttpReply'] = function (string $url, array $args) use (&$statuses): array {
                $this->calls[] = [$url, $args];
                [$status, $body] = array_shift($statuses);
                return ['status' => $status, 'body' => json_encode($body)];
            };
        }

        public function testMailchimpPreservesExistingStatusAndOnlyPatchesMappedFieldsWhenRequested(): void
        {
            $type = new MailchimpDestinationType();
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'A Person'], ['SERVICE' => 'Repairs']);
            $settings = ['audiences' => ['list-1'], 'existing_contact' => 'keep'];
            $credentials = ['api_key' => 'secret-us1'];
            $this->reply([[400, ['title' => 'Member Exists']]]);
            self::assertSame(PushOutcome::Success, $type->push($subject, new PushContext(null, $settings, $credentials))->outcome);
            self::assertCount(1, $this->calls);
            self::assertSame('pending', json_decode($this->calls[0][1]['body'], true)['status']);

            $this->reply([[400, ['title' => 'Member Exists']], [200, []]]);
            $settings['existing_contact'] = 'update';
            self::assertSame(PushOutcome::Success, $type->push($subject, new PushContext(null, $settings, $credentials))->outcome);
            self::assertSame('PATCH', $this->calls[1][1]['method']);
            self::assertSame(['merge_fields' => ['FNAME' => 'A Person', 'SERVICE' => 'Repairs']], json_decode($this->calls[1][1]['body'], true));
        }

        public function testBrevoExistingContactIsAddedToListWithoutOverwritingWhenKept(): void
        {
            $type = new BrevoDestinationType();
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'A Person'], ['SERVICE' => 'Repairs']);
            $this->reply([[400, ['code' => 'duplicate_parameter']], [201, ['failure' => [], 'success' => ['a@example.com']]]]);
            self::assertSame(PushOutcome::Success, $type->push($subject, new PushContext(null, ['lists' => ['42'], 'existing_contact' => 'keep'], ['api_key' => 'secret']))->outcome);
            self::assertSame('POST', $this->calls[1][1]['method']);
            self::assertStringEndsWith('/contacts/lists/42/contacts/add', $this->calls[1][0]);
            self::assertSame(['emails' => ['a@example.com']], json_decode($this->calls[1][1]['body'], true));
            self::assertFalse(json_decode($this->calls[0][1]['body'], true)['updateEnabled']);
        }

        public function testBrevoUpdateOnlyIncludesSelectedAttributesAndList(): void
        {
            $type = new BrevoDestinationType();
            $subject = PushSubject::test(['email' => 'a@example.com'], ['SERVICE' => 'Repairs']);
            $this->reply([[204, []], [204, []]]);
            self::assertSame(PushOutcome::Success, $type->push($subject, new PushContext(null,
                ['lists' => ['42'], 'existing_contact' => 'update'], ['api_key' => 'secret']))->outcome);
            self::assertSame('PUT', $this->calls[1][1]['method']);
            self::assertSame(['listIds' => [42], 'attributes' => ['SERVICE' => 'Repairs']],
                json_decode($this->calls[1][1]['body'], true));
        }

        public function testBrevoTooEarlyResponseIsRetried(): void
        {
            $this->reply([[425, ['code' => 'too_early']]]);
            $result = (new BrevoDestinationType())->push(PushSubject::test(['email' => 'a@example.com']),
                new PushContext(null, ['lists' => ['42']], ['api_key' => 'secret']));
            self::assertSame(PushOutcome::Failed, $result->outcome);
            self::assertTrue($result->retryable);
            self::assertCount(1, $this->calls);
        }

        public function testProviderListPaginationUsesReportedTotal(): void
        {
            $mailchimp = new MailchimpDestinationType();
            $mailchimpLists = array_map(static fn (int $id): array => ['id' => (string) $id, 'name' => "Audience {$id}"], range(1, 100));
            $this->reply([[200, ['lists' => $mailchimpLists, 'total_items' => 100]]]);
            self::assertCount(100, $mailchimp->settingsSchema(['api_key' => 'secret-us1'])['audiences']['options']);
            self::assertCount(1, $this->calls);

            $brevo = new BrevoDestinationType();
            $brevoLists = array_map(static fn (int $id): array => ['id' => $id, 'name' => "List {$id}"], range(1, 50));
            $this->reply([[200, ['lists' => $brevoLists, 'count' => 50]]]);
            self::assertCount(50, $brevo->settingsSchema(['api_key' => 'secret'])['lists']['options']);
            self::assertCount(1, $this->calls);
        }

        public function testProviderAuthFailureNeedsRepairWithoutRepeatedWrites(): void
        {
            $type = new MailchimpDestinationType();
            $this->reply([[401, ['title' => 'Unauthorized']]]);
            $result = $type->push(PushSubject::test(['email' => 'a@example.com']), new PushContext(null,
                ['audiences' => ['list-1']], ['api_key' => 'secret-us1']));
            self::assertSame(PushOutcome::Failed, $result->outcome);
            self::assertTrue($result->needsAttention);
            self::assertCount(1, $this->calls);
        }

        public function testAccountCheckRequiresAccessToAudienceMetadata(): void
        {
            $this->reply([[200, []], [403, []]]);
            try {
                (new MailchimpDestinationType())->testConnection(['api_key' => 'secret-us1']);
                self::fail('An account without audience access must not pass the check.');
            } catch (\RuntimeException $failure) {
                self::assertStringContainsString('audiences', $failure->getMessage());
            }
            self::assertCount(2, $this->calls);
            self::assertStringContainsString('/lists?count=1', $this->calls[1][0]);

            $this->reply([[200, []], [403, []]]);
            try {
                (new BrevoDestinationType())->testConnection(['api_key' => 'secret']);
                self::fail('An account without list access must not pass the check.');
            } catch (\RuntimeException $failure) {
                self::assertStringContainsString('lists', $failure->getMessage());
            }
            self::assertCount(2, $this->calls);
            self::assertStringContainsString('/contacts/lists?limit=1', $this->calls[1][0]);
        }

        public function testEnquiryCreatesContactsWithoutMarketingSignup(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com'], ['SERVICE' => 'Repairs'], 'request');
            $this->reply([[200, []]]);
            self::assertSame(PushOutcome::Success, (new MailchimpDestinationType())->push($subject,
                new PushContext(null, ['audiences' => ['list-1']], ['api_key' => 'secret-us1']))->outcome);
            self::assertSame('transactional', json_decode($this->calls[0][1]['body'], true)['status']);

            $this->reply([[201, ['id' => 1]]]);
            self::assertSame(PushOutcome::Success, (new BrevoDestinationType())->push($subject,
                new PushContext(null, ['lists' => ['42']], ['api_key' => 'secret']))->outcome);
            self::assertArrayNotHasKey('listIds', json_decode($this->calls[0][1]['body'], true));
        }
    }
}
