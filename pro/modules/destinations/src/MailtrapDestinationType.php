<?php

namespace WConvert\Pro\Module\Destinations;

use WConvert\Destination\CanonicalFields;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\DestinationType;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushSubject;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/** Email Contacts created in Mailtrap, joining one list, never touching subscription status. */
final class MailtrapDestinationType implements DestinationType
{
    public function id(): string { return 'mailtrap'; }
    public function label(): string { return __('Mailtrap', 'wconvert'); }
    public function icon(): string { return 'mail'; }
    public function tier(): Tier { return Tier::Elite; }
    public function requires(): ?\WConvert\Support\SiteDependency { return null; }
    /** A push makes one lookup and at most one write; Mailtrap allows 200 Contacts API requests per minute. */
    public function throughput(): int { return 60; }
    /** @return array<string, mixed> */
    public function connectionSchema(): array { return ['api_token' => ['type' => 'password', 'label' => __('Mailtrap API token', 'wconvert')]]; }

    public function requirements(): DestinationRequirements
    {
        return new DestinationRequirements([CanonicalFields::EMAIL], ['lists' => ['label' => __('List', 'wconvert'), 'type' => 'ids']], [CanonicalFields::EMAIL, CanonicalFields::NAME], [], ['email']);
    }

    /** Mailtrap does not document which token permission the Contacts API needs, so reading the lists is the proof. */
    public function testConnection(array $credentials): void
    {
        [$status, $accounts] = $this->request($credentials, 'GET', '/accounts');
        if ($status !== 200 || $accounts === []) throw new \RuntimeException('Mailtrap rejected the account check.');
        [$listsStatus] = $this->request($credentials, 'GET', '/contacts/lists');
        if ($listsStatus !== 200) throw new \RuntimeException('Mailtrap lists could not be read.');
    }

    /** The token's one account; several are refused, since the account-free paths would not say which one a Contact landed in.
     * @param array<string, mixed> $credentials
     */
    public function accountIdentity(array $credentials): string
    {
        [$status, $accounts] = $this->request($credentials, 'GET', '/accounts');
        $identity = count($accounts) === 1 && is_array($accounts[0] ?? null) ? ($accounts[0]['id'] ?? null) : null;
        if ($status !== 200 || !(is_int($identity) || (is_string($identity) && $identity !== ''))) throw new \RuntimeException('Mailtrap account identity unavailable.');
        return (string) $identity;
    }

    /** Mailtrap has no name field, so the Destination says where it goes (ADR 0110). Lists are unpaged: at most 50. */
    public function settingsSchema(array $credentials): array
    {
        if (empty($credentials['api_token'])) return ['lists' => ['type' => 'ids', 'label' => __('List', 'wconvert')]];
        [$status, $lists] = $this->request($credentials, 'GET', '/contacts/lists');
        if ($status !== 200) throw new \RuntimeException('Mailtrap lists could not be read.');
        $options = [];
        foreach ($lists as $list) {
            if (is_array($list) && isset($list['id'], $list['name'])) $options[] = ['value' => (string) $list['id'], 'label' => (string) $list['name']];
        }
        $textFields = $this->fields($credentials);
        $nameSetting = ['type' => 'select', 'label' => __('Name goes to', 'wconvert'), 'options' => $textFields];
        if (in_array('first_name', array_column($textFields, 'value'), true)) $nameSetting['default'] = 'first_name';
        return ['lists' => ['type' => 'ids', 'label' => __('List', 'wconvert'), 'options' => $options],
            'name_field' => $nameSetting,
            'existing_contact' => ['type' => 'select', 'label' => __('If the contact exists', 'wconvert'), 'default' => 'keep', 'options' => [
                ['value' => 'keep', 'label' => __('Keep existing details', 'wconvert')],
                ['value' => 'update', 'label' => __('Update mapped fields', 'wconvert')],
            ]]];
    }

    /** @param array<string, mixed> $credentials
     * @param array<string, mixed> $settings
     * @return list<array{value: string, label: string, type?: 'boolean'}>
     */
    public function mappingFields(array $credentials, array $settings): array
    {
        $name = $settings['name_field'] ?? '';
        return array_values(array_filter($this->fields($credentials, true), static fn (array $field): bool => $field['value'] !== $name));
    }

    /** Names use text; separate interests also offer boolean fields, keyed by merge tag.
     * @param array<string, mixed> $credentials
     * @return list<array{value: string, label: string, type?: 'boolean'}>
     */
    private function fields(array $credentials, bool $includeInterests = false): array
    {
        [$status, $fields] = $this->request($credentials, 'GET', '/contacts/fields');
        if ($status !== 200) throw new \RuntimeException('Mailtrap fields could not be read.');
        $options = [];
        foreach ($fields as $field) {
            if (!is_array($field) || !in_array($field['data_type'] ?? '', $includeInterests ? ['text', 'boolean'] : ['text'], true)) continue;
            $tag = $field['merge_tag'] ?? null;
            if (!is_string($tag) || !self::isTag($tag) || $tag === 'email') continue;
            $options[] = ['value' => $tag, 'label' => is_string($field['name'] ?? null) ? $field['name'] : $tag]
                + ($field['data_type'] === 'boolean' ? ['type' => 'boolean'] : []);
        }
        return $options;
    }

    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $email = $subject->values[CanonicalFields::EMAIL] ?? '';
        if (!is_email($email)) return PushResult::terminal(__('This submission has no valid email address.', 'wconvert'));
        $lists = DestinationRequirements::ids($context->settings['lists'] ?? null);
        if (count($lists) !== 1 || !ctype_digit($lists[0])) return PushResult::attention(__('Choose one Mailtrap list.', 'wconvert'));
        $listId = (int) $lists[0];
        $nameField = $context->settings['name_field'] ?? '';
        $nameField = is_string($nameField) && self::isTag($nameField) ? $nameField : '';
        $fields = [];
        // The whole name, unsplit.
        if ($nameField !== '' && trim($subject->values[CanonicalFields::NAME] ?? '') !== '') $fields[$nameField] = $subject->values[CanonicalFields::NAME];
        foreach ($subject->mapped as $tag => $value) {
            if (self::isTag($tag) && !in_array($tag, ['email', $nameField], true)
                && ($value === true || (is_string($value) && trim($value) !== ''))) $fields[$tag] = $value;
        }
        // Enquiries may be stored as Contacts but must not enter a marketing list.
        $marketing = $subject->purpose === 'email_marketing';
        try {
            // Mailtrap applies a write seconds after answering and refuses a second one meanwhile, so a
            // create-then-fix-up sequence is not possible: look the address up, then write exactly once.
            // Only existence and the id are read — never status or lists (CONTEXT: Destination).
            [$found, $existing] = $this->request($context->credentials, 'GET', '/contacts/' . rawurlencode($email));
            if ($found === 404) {
                $contact = ($fields !== [] ? ['fields' => $fields] : []) + ($marketing ? ['list_ids' => [$listId]] : []);
                return $this->outcome(...$this->request($context->credentials, 'POST', '/contacts', ['contact' => ['email' => $email] + $contact]));
            }
            if ($found !== 200) return $this->failure($found);
            $id = $existing['data']['id'] ?? null;
            if (!is_string($id) || !preg_match('/^[A-Za-z0-9-]{1,64}$/D', $id)) return PushResult::retryable(__('Mailtrap is temporarily unavailable.', 'wconvert'));
            // Keep: an existing Contact's details stay as they are; a signup only adds the list.
            $update = ($context->settings['existing_contact'] ?? 'keep') === 'update' && $fields !== [] ? ['fields' => $fields] : [];
            $change = $update + ($marketing ? ['list_ids_included' => [$listId]] : []);
            if ($change === []) return PushResult::success();
            return $this->outcome(...$this->request($context->credentials, 'PATCH', '/contacts/' . $id, ['contact' => ['email' => $email] + $change]));
        } catch (\Throwable $failure) {
            return PushResult::retryable(__('Mailtrap could not be reached. The result may be uncertain.', 'wconvert'));
        }
    }

    /**
     * Of a write. Never `unsubscribed` or `list_ids_excluded` is sent, so status and membership only
     * ever grow. A 422 naming the email means another write for the address has not landed yet.
     *
     * @param array<mixed> $body
     */
    private function outcome(int $status, array $body = []): PushResult
    {
        if ($status >= 200 && $status < 300) return PushResult::success();
        return $this->failure($status === 422 && isset($body['errors']['email']) ? 409 : $status);
    }

    /** By status alone: Mailtrap's error bodies differ by endpoint, and none of them is shown. */
    private function failure(int $status): PushResult
    {
        if ($status === 401 || $status === 403) return PushResult::attention(__('Mailtrap access was refused. Check this account.', 'wconvert'));
        // 409: the Contact is still being written by an earlier request.
        if ($status === 409 || $status === 429 || $status >= 500) return PushResult::retryable(__('Mailtrap is temporarily unavailable.', 'wconvert'));
        return PushResult::terminal(__('Mailtrap rejected this contact or list.', 'wconvert'));
    }

    /** A merge tag in the shape a campaign mapping can store (`PushSubject::of`), so nothing offered is later dropped. */
    private static function isTag(string $tag): bool
    {
        return preg_match('/^[A-Za-z][A-Za-z0-9_]{0,31}$/D', $tag) === 1;
    }

    /** Account-free paths (spec, May 2026); a fallback to `/accounts/{id}/…` would change only here.
     * @param array<string, mixed> $credentials
     * @param array<string, mixed>|null $body
     * @return array{int, array<mixed>}
     */
    private function request(array $credentials, string $method, string $path, ?array $body = null): array
    {
        $token = $credentials['api_token'] ?? '';
        if (!is_string($token) || $token === '') throw new \RuntimeException('Missing Mailtrap token.');
        $args = ['method' => $method, 'timeout' => 12, 'redirection' => 0,
            'headers' => ['Api-Token' => $token, 'Accept' => 'application/json']];
        if ($body !== null) {
            $args['headers']['Content-Type'] = 'application/json';
            $args['body'] = wp_json_encode($body);
        }
        $response = wp_remote_request('https://mailtrap.io/api' . $path, $args);
        if (is_wp_error($response)) throw new \RuntimeException('Mailtrap transport failed.');
        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
        return [(int) wp_remote_retrieve_response_code($response), is_array($decoded) ? $decoded : []];
    }
}
