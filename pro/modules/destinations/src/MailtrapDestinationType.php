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

/** Email Contacts upserted into Mailtrap, joining one list, never touching subscription status. */
final class MailtrapDestinationType implements DestinationType
{
    public function id(): string { return 'mailtrap'; }
    public function label(): string { return __('Mailtrap', 'wconvert'); }
    public function icon(): string { return 'mail'; }
    public function tier(): Tier { return Tier::Elite; }
    public function requires(): ?\WConvert\Support\SiteDependency { return null; }
    /** A push makes at most two writes; Mailtrap allows 200 Contacts API requests per minute. */
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

    /**
     * The token's one account. A token that reaches several is refused rather than guessed at,
     * because the account-free paths would not say which one a Contact landed in.
     *
     * @param array<string, mixed> $credentials
     */
    public function accountIdentity(array $credentials): string
    {
        [$status, $accounts] = $this->request($credentials, 'GET', '/accounts');
        $identity = count($accounts) === 1 && is_array($accounts[0] ?? null) ? ($accounts[0]['id'] ?? null) : null;
        if ($status !== 200 || !(is_int($identity) || (is_string($identity) && $identity !== ''))) throw new \RuntimeException('Mailtrap account identity unavailable.');
        return (string) $identity;
    }

    /**
     * Mailtrap has no name field of its own, so the Destination says where the name goes —
     * shared setup, preselected to `first_name` where the account has one (ADR 0110).
     * Lists are not paged: an account holds at most 50.
     */
    public function settingsSchema(array $credentials): array
    {
        if (empty($credentials['api_token'])) return ['lists' => ['type' => 'ids', 'label' => __('List', 'wconvert')]];
        [$status, $lists] = $this->request($credentials, 'GET', '/contacts/lists');
        if ($status !== 200) throw new \RuntimeException('Mailtrap lists could not be read.');
        $options = [];
        foreach ($lists as $list) {
            if (is_array($list) && isset($list['id'], $list['name'])) $options[] = ['value' => (string) $list['id'], 'label' => (string) $list['name']];
        }
        $text = $this->textFields($credentials);
        $name = ['type' => 'select', 'label' => __('Name goes to', 'wconvert'), 'options' => $text];
        if (in_array('first_name', array_column($text, 'value'), true)) $name['default'] = 'first_name';
        return ['lists' => ['type' => 'ids', 'label' => __('List', 'wconvert'), 'options' => $options],
            'name_field' => $name,
            'existing_contact' => ['type' => 'select', 'label' => __('If the contact exists', 'wconvert'), 'default' => 'keep', 'options' => [
                ['value' => 'keep', 'label' => __('Keep existing details', 'wconvert')],
                ['value' => 'update', 'label' => __('Update mapped fields', 'wconvert')],
            ]]];
    }

    /** @param array<string, mixed> $credentials
     * @param array<string, mixed> $settings
     * @return list<array{value: string, label: string}>
     */
    public function mappingFields(array $credentials, array $settings): array
    {
        $name = $settings['name_field'] ?? '';
        return array_values(array_filter($this->textFields($credentials), static fn (array $field): bool => $field['value'] !== $name));
    }

    /**
     * Text fields only, until typed conversion exists; a value is keyed by its merge tag.
     *
     * @param array<string, mixed> $credentials
     * @return list<array{value: string, label: string}>
     */
    private function textFields(array $credentials): array
    {
        [$status, $fields] = $this->request($credentials, 'GET', '/contacts/fields');
        if ($status !== 200) throw new \RuntimeException('Mailtrap fields could not be read.');
        $options = [];
        foreach ($fields as $field) {
            if (!is_array($field) || ($field['data_type'] ?? '') !== 'text') continue;
            $tag = $field['merge_tag'] ?? null;
            if (!is_string($tag) || !self::isTag($tag) || $tag === 'email') continue;
            $options[] = ['value' => $tag, 'label' => is_string($field['name'] ?? null) ? $field['name'] : $tag];
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
        // Mailtrap has no name of its own: the whole name goes to the field the merchant chose, unsplit.
        if ($nameField !== '' && trim($subject->values[CanonicalFields::NAME] ?? '') !== '') $fields[$nameField] = $subject->values[CanonicalFields::NAME];
        foreach ($subject->mapped as $tag => $value) {
            if (self::isTag($tag) && !in_array($tag, ['email', $nameField], true) && trim($value) !== '') $fields[$tag] = $value;
        }
        // Enquiries may be stored as Contacts but must not enter a marketing list.
        $marketing = $subject->purpose === 'email_marketing';
        try {
            if (($context->settings['existing_contact'] ?? 'keep') === 'update') {
                $change = $fields !== [] ? ['fields' => $fields] : [];
                if ($marketing) $change['list_ids_included'] = [$listId];
                return $this->upsert($context->credentials, $email, $change)[0];
            }
            // Keep: create bare first, so an existing contact's details are never overwritten.
            [$created, $action] = $this->upsert($context->credentials, $email, []);
            if ($created->isFailure()) return $created;
            // Fields before the list, so an "added to list" automation already sees the name.
            $change = $action === 'created' && $fields !== [] ? ['fields' => $fields] : [];
            if ($marketing) $change['list_ids_included'] = [$listId];
            return $change === [] ? $created : $this->upsert($context->credentials, $email, $change)[0];
        } catch (\Throwable $failure) {
            return PushResult::retryable(__('Mailtrap could not be reached. The result may be uncertain.', 'wconvert'));
        }
    }

    /**
     * The one write: `PATCH /contacts/{email}` creates or updates and reports which.
     * `unsubscribed` and `list_ids_excluded` are never sent, so status and membership only ever grow.
     *
     * @param array<string, mixed> $credentials
     * @param array<string, mixed> $change
     * @return array{PushResult, string}
     */
    private function upsert(array $credentials, string $email, array $change): array
    {
        [$status, $body] = $this->request($credentials, 'PATCH', '/contacts/' . rawurlencode($email), ['contact' => ['email' => $email] + $change]);
        $action = $body['action'] ?? null;
        return [$status >= 200 && $status < 300 ? PushResult::success() : $this->failure($status), is_string($action) ? $action : ''];
    }

    /** By status alone: Mailtrap's error bodies differ by endpoint, and none of them is shown. */
    private function failure(int $status): PushResult
    {
        if ($status === 401 || $status === 403) return PushResult::attention(__('Mailtrap access was refused. Check this account.', 'wconvert'));
        if ($status === 429 || $status >= 500) return PushResult::retryable(__('Mailtrap is temporarily unavailable.', 'wconvert'));
        return PushResult::terminal(__('Mailtrap rejected this contact or list.', 'wconvert'));
    }

    /** A merge tag in the shape a campaign mapping can store (`PushSubject::of`), so nothing offered is later dropped. */
    private static function isTag(string $tag): bool
    {
        return preg_match('/^[A-Za-z][A-Za-z0-9_]{0,31}$/D', $tag) === 1;
    }

    /**
     * Account-free paths, as the published spec has had them since May 2026. Should the live
     * check need the older `/accounts/{id}/…` form, this is the one place that changes.
     *
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
