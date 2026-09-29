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

/** Mailchimp's email-audience adapter. It never changes a member's status on update. */
final class MailchimpDestinationType implements DestinationType
{
    public function id(): string { return 'mailchimp'; }
    public function label(): string { return __('Mailchimp', 'wconvert'); }
    public function icon(): string { return 'mail'; }
    public function tier(): Tier { return Tier::Elite; }
    public function requires(): ?\WConvert\Support\SiteDependency { return null; }
    public function throughput(): int { return 60; }

    public function connectionSchema(): array
    {
        return ['api_key' => ['type' => 'password', 'label' => __('Mailchimp API key', 'wconvert')]];
    }

    public function requirements(): DestinationRequirements
    {
        return new DestinationRequirements(
            [CanonicalFields::EMAIL],
            ['audiences' => ['label' => __('Audience', 'wconvert'), 'type' => 'ids']],
            [CanonicalFields::EMAIL, CanonicalFields::NAME],
            [],
            ['email']
        );
    }

    public function testConnection(array $credentials): void
    {
        [$status] = $this->request($credentials, 'GET', '/ping');
        if ($status !== 200) throw new \RuntimeException('Mailchimp rejected the account check.');
    }

    /** @param array<string, mixed> $credentials */
    public function accountIdentity(array $credentials): string
    {
        [$status, $body] = $this->request($credentials, 'GET', '/');
        $identity = $body['account_id'] ?? null;
        if ($status !== 200 || !is_string($identity) || $identity === '') throw new \RuntimeException('Mailchimp account identity unavailable.');
        return $identity;
    }

    public function settingsSchema(array $credentials): array
    {
        if (empty($credentials['api_key'])) return ['audiences' => ['type' => 'ids', 'label' => __('Audience', 'wconvert')]];
        $options = [];
        for ($offset = 0; $offset < 1000; $offset += 100) {
            [$status, $body] = $this->request($credentials, 'GET', '/lists?count=100&offset=' . $offset . '&fields=lists.id,lists.name,total_items');
            if ($status !== 200) throw new \RuntimeException('Mailchimp audiences could not be read.');
            $lists = $body['lists'] ?? [];
            foreach ($lists as $list) {
                if (is_array($list) && isset($list['id'], $list['name'])) $options[] = ['value' => (string) $list['id'], 'label' => (string) $list['name']];
            }
            if (count($lists) < 100) break;
        }
        return ['audiences' => ['type' => 'ids', 'label' => __('Audience', 'wconvert'), 'options' => $options],
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
        $audiences = DestinationRequirements::ids($settings['audiences'] ?? null);
        if (count($audiences) !== 1) return [];
        $options = [];
        for ($offset = 0; $offset < 1000; $offset += 100) {
            [$status, $body] = $this->request($credentials, 'GET', '/lists/' . rawurlencode($audiences[0]) . '/merge-fields?count=100&offset=' . $offset);
            if ($status !== 200) throw new \RuntimeException('Mailchimp fields could not be read.');
            $fields = $body['merge_fields'] ?? [];
            foreach ($fields as $field) {
                if (!is_array($field) || ($field['type'] ?? '') !== 'text' || !is_string($field['tag'] ?? null)) continue;
                if (in_array($field['tag'], ['FNAME', 'LNAME', 'EMAIL'], true)) continue;
                $options[] = ['value' => $field['tag'], 'label' => (string) ($field['name'] ?? $field['tag'])];
            }
            if (count($fields) < 100) break;
        }
        return $options;
    }

    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $email = $subject->values[CanonicalFields::EMAIL] ?? '';
        if (!is_email($email)) return PushResult::terminal(__('This submission has no valid email address.', 'wconvert'));
        $audiences = DestinationRequirements::ids($context->settings['audiences'] ?? null);
        if (count($audiences) !== 1) return PushResult::attention(__('Choose one Mailchimp audience.', 'wconvert'));
        $audience = rawurlencode($audiences[0]);
        $merge = [];
        if (isset($subject->values[CanonicalFields::NAME])) $merge['FNAME'] = $subject->values[CanonicalFields::NAME];
        foreach ($subject->mapped as $tag => $value) {
            if (preg_match('/^[A-Z][A-Z0-9_]{0,9}$/D', $tag) && !in_array($tag, ['FNAME', 'LNAME', 'EMAIL'], true)) $merge[$tag] = $value;
        }
        // A request/enquiry is a Contact, not permission to send marketing.
        $payload = ['email_address' => $email, 'status' => $subject->purpose === 'email_marketing' ? 'pending' : 'transactional'];
        if ($merge !== []) $payload['merge_fields'] = $merge;
        try {
            [$status, $body] = $this->request($context->credentials, 'POST', '/lists/' . $audience . '/members', $payload);
            if ($status >= 200 && $status < 300) return PushResult::success();
            if ($status === 400 && ($body['title'] ?? '') === 'Member Exists') {
                if (($context->settings['existing_contact'] ?? 'keep') !== 'update' || $merge === []) return PushResult::success();
                $hash = md5(strtolower($email));
                [$updated] = $this->request($context->credentials, 'PATCH', '/lists/' . $audience . '/members/' . $hash, ['merge_fields' => $merge]);
                if ($updated >= 200 && $updated < 300) return PushResult::success();
                return $this->failure($updated);
            }
            return $this->failure($status);
        } catch (\Throwable $failure) {
            return PushResult::retryable(__('Mailchimp could not be reached. The result may be uncertain.', 'wconvert'));
        }
    }

    private function failure(int $status): PushResult
    {
        if ($status === 401 || $status === 403) return PushResult::attention(__('Mailchimp access was refused. Check this account.', 'wconvert'));
        if ($status === 429 || $status >= 500) return PushResult::retryable(__('Mailchimp is temporarily unavailable.', 'wconvert'));
        return PushResult::terminal(__('Mailchimp rejected this contact or audience.', 'wconvert'));
    }

    /** @param array<string, mixed> $credentials
     * @param array<string, mixed>|null $body
     * @return array{int, array<string, mixed>}
     */
    private function request(array $credentials, string $method, string $path, ?array $body = null): array
    {
        $key = $credentials['api_key'] ?? '';
        if (!is_string($key) || !preg_match('/-([a-z]{2}[0-9]+)$/i', $key, $match)) throw new \RuntimeException('Invalid Mailchimp key.');
        $host = strtolower($match[1]) . '.api.mailchimp.com';
        $args = [
            'method' => $method,
            'timeout' => 12,
            'redirection' => 0,
            'headers' => ['Authorization' => 'Basic ' . base64_encode('wconvert:' . $key), 'Accept' => 'application/json'],
        ];
        if ($body !== null) {
            $args['headers']['Content-Type'] = 'application/json';
            $args['body'] = wp_json_encode($body);
        }
        $response = wp_remote_request('https://' . $host . '/3.0' . $path, $args);
        if (is_wp_error($response)) throw new \RuntimeException('Mailchimp transport failed.');
        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
        return [(int) wp_remote_retrieve_response_code($response), is_array($decoded) ? $decoded : []];
    }
}
