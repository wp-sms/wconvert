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
    use WConvert\Pro\Module\Destinations\MailtrapDestinationType;

    final class RemoteProviderWritesTest extends TestCase
    {
        /** @var list<array{string, array<string, mixed>}> */
        private array $calls = [];

        /** @param list<array{int, array<mixed>}> $statuses */
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

        /** @param array<string, mixed> $settings */
        private function mailtrap(PushSubject $subject, array $settings = []): \WConvert\Destination\PushResult
        {
            return (new MailtrapDestinationType())->push($subject, new PushContext(null,
                $settings + ['lists' => ['7'], 'name_field' => 'first_name', 'existing_contact' => 'keep'], ['api_token' => 'secret']));
        }

        /** @return array<string, mixed> */
        private function sent(int $call): array
        {
            return json_decode($this->calls[$call][1]['body'], true);
        }

        /** Mailtrap's answer to a write for an address it already holds, as seen on a live account. */
        private const TAKEN = [422, ['errors' => ['email' => ['has already been taken']]]];
        private const ABSENT = [404, ['error' => 'Not Found']];
        /** The lookup's answer for a Contact that exists. Status and lists are there too; the adapter reads only the id. */
        private const PRESENT = [200, ['data' => ['id' => '018dd5e3-f6d2-7c00', 'status' => 'unsubscribed', 'list_ids' => [3]]]];

        public function testMailtrapNewContactIsCreatedWithItsDetailsAndListInOneWrite(): void
        {
            $this->reply([self::ABSENT, [201, ['data' => ['id' => 'c1']]]]);
            $result = $this->mailtrap(PushSubject::test(['email' => 'a+b@example.com', 'name' => 'Ada Lovelace'], ['company' => 'Engines']));
            self::assertSame(PushOutcome::Success, $result->outcome);
            self::assertCount(2, $this->calls);
            self::assertSame('GET', $this->calls[0][1]['method']);
            self::assertSame('https://mailtrap.io/api/contacts/a%2Bb%40example.com', $this->calls[0][0]);
            self::assertSame('secret', $this->calls[0][1]['headers']['Api-Token']);
            self::assertSame('POST', $this->calls[1][1]['method']);
            self::assertSame('https://mailtrap.io/api/contacts', $this->calls[1][0]);
            self::assertSame(['contact' => ['email' => 'a+b@example.com',
                'fields' => ['first_name' => 'Ada Lovelace', 'company' => 'Engines'], 'list_ids' => [7]]], $this->sent(1));
        }

        public function testMailtrapKeptContactOnlyJoinsTheListById(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], ['company' => 'Engines']);
            $this->reply([self::PRESENT, [200, ['action' => 'updated']]]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($subject)->outcome);
            self::assertCount(2, $this->calls);
            self::assertSame('PATCH', $this->calls[1][1]['method']);
            self::assertSame('https://mailtrap.io/api/contacts/018dd5e3-f6d2-7c00', $this->calls[1][0]);
            self::assertSame(['contact' => ['email' => 'a@example.com', 'list_ids_included' => [7]]], $this->sent(1));

            $enquiry = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], ['company' => 'Engines'], 'request');
            $this->reply([self::PRESENT]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($enquiry)->outcome);
            self::assertCount(1, $this->calls);
        }

        public function testMailtrapSendsSeparateInterestsAsBooleansAndOnlyUpdatesMappedSelections(): void
        {
            $this->reply([self::ABSENT, [201, []]]);
            $this->mailtrap(PushSubject::test(['email' => 'a@example.com'], ['running' => true, 'hiking' => true]));
            self::assertSame(['running' => true, 'hiking' => true], $this->sent(1)['contact']['fields']);

            $this->reply([self::PRESENT, [200, []]]);
            $this->mailtrap(PushSubject::test(['email' => 'a@example.com'], ['hiking' => true]), ['existing_contact' => 'update']);
            self::assertSame(['hiking' => true], $this->sent(1)['contact']['fields']);
            self::assertArrayNotHasKey('running', $this->sent(1)['contact']['fields']);

            $this->reply([self::PRESENT, [200, []]]);
            $this->mailtrap(PushSubject::test(['email' => 'a@example.com'], ['hiking' => true]));
            self::assertArrayNotHasKey('fields', $this->sent(1)['contact']);
        }

        /** Mailtrap applies a write seconds after answering, and refuses a second one to that Contact meanwhile. */
        public function testMailtrapContactStillBeingWrittenIsRetried(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada']);
            $cases = [
                [self::ABSENT, [409, ['errors' => 'Contact exists']]],
                [self::ABSENT, self::TAKEN],  // created by another push, not yet visible to the lookup
                [self::PRESENT, [409, ['errors' => 'Contact exists or being updated']]],
                [self::PRESENT, self::TAKEN],
            ];
            foreach (['keep', 'update'] as $mode) {
                foreach ($cases as $replies) {
                    $this->reply($replies);
                    self::assertTrue($this->mailtrap($subject, ['existing_contact' => $mode])->retryable, $mode);
                    self::assertCount(2, $this->calls);
                }
            }
        }

        public function testMailtrapUpdateModeWritesOnceAndEnquiriesNeverJoinTheList(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], ['company' => 'Engines']);
            $this->reply([self::PRESENT, [200, ['action' => 'updated']]]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($subject, ['existing_contact' => 'update'])->outcome);
            self::assertSame('PATCH', $this->calls[1][1]['method']);
            self::assertSame(['contact' => ['email' => 'a@example.com',
                'fields' => ['first_name' => 'Ada', 'company' => 'Engines'], 'list_ids_included' => [7]]], $this->sent(1));
            $this->reply([self::ABSENT, [201, []]]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($subject, ['existing_contact' => 'update'])->outcome);
            self::assertSame('POST', $this->calls[1][1]['method']);

            $enquiry = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], [], 'request');
            $this->reply([self::PRESENT, [200, []]]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($enquiry, ['existing_contact' => 'update'])->outcome);
            self::assertSame(['contact' => ['email' => 'a@example.com', 'fields' => ['first_name' => 'Ada']]], $this->sent(1));
            $this->reply([self::ABSENT, [201, []]]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($enquiry)->outcome);
            self::assertSame(['contact' => ['email' => 'a@example.com', 'fields' => ['first_name' => 'Ada']]], $this->sent(1));
            // Nothing to change on an existing Contact: no write at all.
            $this->reply([self::PRESENT]);
            self::assertSame(PushOutcome::Success, $this->mailtrap(PushSubject::test(['email' => 'a@example.com'], [], 'request'), ['existing_contact' => 'update'])->outcome);
            self::assertCount(1, $this->calls);
        }

        public function testMailtrapSendsOnlyNonEmptyValuesForValidUnreservedFields(): void
        {
            $mapped = ['company' => 'Engines', 'role' => '  ', 'email' => 'b@example.com', 'first_name' => 'Ignored',
                '9lives' => 'x', 'has-dash' => 'x'];
            $this->reply([self::ABSENT, [201, []]]);
            $this->mailtrap(PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], $mapped));
            self::assertSame(['first_name' => 'Ada', 'company' => 'Engines'], $this->sent(1)['contact']['fields']);

            $this->reply([self::ABSENT, [201, []]]);
            $this->mailtrap(PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], ['first_name' => 'Kept']), ['name_field' => '']);
            self::assertSame(['first_name' => 'Kept'], $this->sent(1)['contact']['fields']);

            $this->reply([self::ABSENT, [201, []]]);
            $this->mailtrap(PushSubject::test(['email' => 'a@example.com'], [], 'request'), ['name_field' => '']);
            self::assertSame(['contact' => ['email' => 'a@example.com']], $this->sent(1));
        }

        public function testMailtrapRefusesBadInputBeforeAnyRequest(): void
        {
            $this->reply([]);
            $result = $this->mailtrap(PushSubject::test(['email' => 'not-an-email']));
            self::assertSame(PushOutcome::Failed, $result->outcome);
            self::assertFalse($result->retryable);
            self::assertFalse($result->needsAttention);
            foreach ([[], ['7', '8'], ['list-7']] as $lists) {
                $result = $this->mailtrap(PushSubject::test(['email' => 'a@example.com']), ['lists' => $lists]);
                self::assertTrue($result->needsAttention);
                self::assertSame('Choose one Mailtrap list.', $result->reason);
            }
            self::assertSame([], $this->calls);
        }

        public function testMailtrapClassifiesEachRequestByStatus(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada']);
            $kinds = [401 => 'attention', 403 => 'attention', 409 => 'retry', 429 => 'retry', 500 => 'retry', 503 => 'retry', 422 => 'terminal', 400 => 'terminal'];
            foreach ($kinds as $status => $kind) {
                // A 422 that names a field or list rather than the email is a rejected value.
                $body = $status === 422 ? ['errors' => ['fields' => ['contains invalid values: secret detail']]] : ['errors' => 'secret detail'];
                foreach ([[[$status, $body]], [self::ABSENT, [$status, $body]], [self::PRESENT, [$status, $body]]] as $replies) {
                    $this->reply($replies);
                    $result = $this->mailtrap($subject);
                    self::assertSame(PushOutcome::Failed, $result->outcome, "{$status} must fail");
                    self::assertSame($kind === 'attention', $result->needsAttention, "{$status} attention");
                    self::assertSame($kind === 'retry', $result->retryable, "{$status} retry");
                    self::assertStringNotContainsString('secret', (string) $result->reason);
                    self::assertCount(count($replies), $this->calls);
                }
            }
            $this->reply([[200, ['data' => ['status' => 'subscribed']]]]);
            self::assertTrue($this->mailtrap($subject)->retryable, 'A lookup without an id is not trusted.');
            self::assertCount(1, $this->calls);
        }

        public function testMailtrapTimeoutIsUncertainAndItsReplaySendsTheSameSafeWrites(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], ['company' => 'Engines']);
            $replies = [self::ABSENT];
            $GLOBALS['wconvertHttpReply'] = function (string $url, array $args) use (&$replies): array {
                $this->calls[] = [$url, $args];
                if ($replies === []) throw new \RuntimeException('cURL error 28 for a@example.com');
                [$status, $body] = array_shift($replies);
                return ['status' => $status, 'body' => json_encode($body)];
            };
            $result = $this->mailtrap($subject);
            self::assertTrue($result->retryable);
            self::assertSame('Mailtrap could not be reached. The result may be uncertain.', $result->reason);
            self::assertSame('POST', $this->calls[1][1]['method']);

            // The create landed before the timeout, details and all, so the retry only adds the list.
            $this->reply([self::PRESENT, [200, ['action' => 'updated']]]);
            self::assertSame(PushOutcome::Success, $this->mailtrap($subject)->outcome);
            self::assertSame(['contact' => ['email' => 'a@example.com', 'list_ids_included' => [7]]], $this->sent(1));
        }

        public function testMailtrapAccountCheckNeedsAuthAndListAccess(): void
        {
            $type = new MailtrapDestinationType();
            $this->reply([[200, [['id' => 11, 'name' => 'Shop', 'access_levels' => [1000]]]], [200, []]]);
            $type->testConnection(['api_token' => 'secret']);
            self::assertSame('https://mailtrap.io/api/accounts', $this->calls[0][0]);
            self::assertSame('https://mailtrap.io/api/contacts/lists', $this->calls[1][0]);
            self::assertSame('GET', $this->calls[1][1]['method']);

            foreach ([[[401, ['error' => 'Unauthorized']]], [[200, []]], [[200, [['id' => 11]]], [403, []]]] as $replies) {
                $this->reply($replies);
                try {
                    $type->testConnection(['api_token' => 'secret']);
                    self::fail('A token without account and list access must not pass the check.');
                } catch (\RuntimeException $failure) {
                    self::assertStringNotContainsString('Unauthorized', $failure->getMessage());
                }
                self::assertCount(count($replies), $this->calls);
            }
        }

        public function testMailtrapAccountIdentityIsTheTokensOneAccount(): void
        {
            $type = new MailtrapDestinationType();
            $this->reply([[200, [['id' => 11, 'name' => 'Shop']]]]);
            self::assertSame('11', $type->accountIdentity(['api_token' => 'secret']));

            foreach ([[], [['id' => 11], ['id' => 12]], [['name' => 'No id']]] as $accounts) {
                $this->reply([[200, $accounts]]);
                try {
                    $type->accountIdentity(['api_token' => 'secret']);
                    self::fail('An ambiguous account must not be saved as the Connection identity.');
                } catch (\RuntimeException $failure) {
                    self::assertStringContainsString('Mailtrap', $failure->getMessage());
                }
            }
        }

        /** @return list<array<string, string>> */
        private function mailtrapFields(): array
        {
            return [
                ['name' => 'First name', 'data_type' => 'text', 'merge_tag' => 'first_name'],
                ['name' => 'Company', 'data_type' => 'text', 'merge_tag' => 'company'],
                ['name' => 'Running', 'data_type' => 'boolean', 'merge_tag' => 'running'],
                ['name' => 'Seats', 'data_type' => 'integer', 'merge_tag' => 'seats'],
                ['name' => 'Joined', 'data_type' => 'date', 'merge_tag' => 'joined'],
                ['name' => 'Odd', 'data_type' => 'text', 'merge_tag' => '2fa-code'],
            ];
        }

        public function testMailtrapSettingsOfferListsTextNameTargetsAndExistingContactPolicy(): void
        {
            $type = new MailtrapDestinationType();
            self::assertSame(['lists'], array_keys($type->settingsSchema([])));
            self::assertSame([], $this->calls);

            $this->reply([[200, [['id' => 7, 'name' => 'Newsletter'], ['id' => 8, 'name' => 'Leads']]], [200, $this->mailtrapFields()]]);
            $schema = $type->settingsSchema(['api_token' => 'secret']);
            self::assertSame(['lists', 'name_field', 'existing_contact'], array_keys($schema));
            self::assertSame([['value' => '7', 'label' => 'Newsletter'], ['value' => '8', 'label' => 'Leads']], $schema['lists']['options']);
            self::assertSame('select', $schema['name_field']['type']);
            self::assertSame('first_name', $schema['name_field']['default']);
            self::assertSame([['value' => 'first_name', 'label' => 'First name'], ['value' => 'company', 'label' => 'Company']], $schema['name_field']['options']);
            self::assertSame('keep', $schema['existing_contact']['default']);
            self::assertSame(['https://mailtrap.io/api/contacts/lists', 'https://mailtrap.io/api/contacts/fields'], array_column($this->calls, 0));

            $this->reply([[200, []], [200, [['name' => 'Company', 'data_type' => 'text', 'merge_tag' => 'company']]]]);
            self::assertArrayNotHasKey('default', $type->settingsSchema(['api_token' => 'secret'])['name_field']);

            $this->reply([[401, []]]);
            $this->expectException(\RuntimeException::class);
            $type->settingsSchema(['api_token' => 'secret']);
        }

        public function testMailtrapMappingFieldsIncludeTypedInterestsAndExcludeEmailAndName(): void
        {
            $type = new MailtrapDestinationType();
            $this->reply([[200, $this->mailtrapFields()]]);
            self::assertSame([['value' => 'company', 'label' => 'Company'], ['value' => 'running', 'label' => 'Running', 'type' => 'boolean']], $type->mappingFields(['api_token' => 'secret'], ['name_field' => 'first_name']));
            $this->reply([[200, $this->mailtrapFields()]]);
            self::assertSame(['first_name', 'company', 'running'], array_column($type->mappingFields(['api_token' => 'secret'], ['name_field' => '']), 'value'));
            $this->reply([[500, []]]);
            $this->expectException(\RuntimeException::class);
            $type->mappingFields(['api_token' => 'secret'], []);
        }

        public function testMailtrapNeverSendsStatusOrListRemoval(): void
        {
            $subject = PushSubject::test(['email' => 'a@example.com', 'name' => 'Ada'], ['company' => 'Engines']);
            $bodies = [];
            foreach (['keep', 'update'] as $mode) {
                foreach ([[self::ABSENT, [201, []]], [self::PRESENT, [200, []]]] as $replies) {
                    $this->reply($replies);
                    $this->mailtrap($subject, ['existing_contact' => $mode]);
                    foreach ($this->calls as $call) $bodies[] = $call[1]['body'] ?? '';
                }
            }
            foreach ($bodies as $body) {
                self::assertStringNotContainsString('unsubscribed', $body);
                self::assertStringNotContainsString('list_ids_excluded', $body);
            }
        }
    }
}
