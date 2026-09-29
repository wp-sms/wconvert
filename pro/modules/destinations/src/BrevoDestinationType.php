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

/** Email Contacts sent to one Brevo list, without touching blacklist flags. */
final class BrevoDestinationType implements DestinationType
{
    public function id(): string { return 'brevo'; }
    public function label(): string { return __('Brevo', 'wconvert'); }
    public function icon(): string { return 'mail'; }
    public function tier(): Tier { return Tier::Elite; }
    public function requires(): ?\WConvert\Support\SiteDependency { return null; }
    public function throughput(): int { return 60; }
    /** @return array<string, mixed> */
    public function connectionSchema(): array { return ['api_key' => ['type' => 'password', 'label' => __('Brevo API key', 'wconvert')]]; }

    public function requirements(): DestinationRequirements
    {
        return new DestinationRequirements([CanonicalFields::EMAIL], ['lists' => ['label' => __('List', 'wconvert'), 'type' => 'ids']], [CanonicalFields::EMAIL, CanonicalFields::NAME], [], ['email']);
    }

    public function testConnection(array $credentials): void
    {
        [$status] = $this->request($credentials, 'GET', '/account');
        if ($status !== 200) throw new \RuntimeException('Brevo rejected the account check.');
    }

    /** @param array<string, mixed> $credentials */
    public function accountIdentity(array $credentials): string
    {
        [$status, $body] = $this->request($credentials, 'GET', '/account');
        $identity = $body['organization_id'] ?? null;
        if ($status !== 200 || !is_string($identity) || $identity === '') throw new \RuntimeException('Brevo account identity unavailable.');
        return $identity;
    }

    public function settingsSchema(array $credentials): array
    {
        if (empty($credentials['api_key'])) return ['lists' => ['type' => 'ids', 'label' => __('List', 'wconvert')]];
        $options = [];
        for ($offset = 0; $offset < 500; $offset += 50) {
            [$status, $body] = $this->request($credentials, 'GET', '/contacts/lists?limit=50&offset=' . $offset);
            if ($status !== 200) throw new \RuntimeException('Brevo lists could not be read.');
            $lists = $body['lists'] ?? [];
            foreach ($lists as $list) {
                if (is_array($list) && isset($list['id'], $list['name'])) $options[] = ['value' => (string) $list['id'], 'label' => (string) $list['name']];
            }
            if (count($lists) < 50) break;
        }
        return ['lists' => ['type' => 'ids', 'label' => __('List', 'wconvert'), 'options' => $options],
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
        unset($settings);
        [$status, $body] = $this->request($credentials, 'GET', '/contacts/attributes');
        if ($status !== 200) throw new \RuntimeException('Brevo attributes could not be read.');
        $options = [];
        foreach ($body['attributes'] ?? [] as $attribute) {
            if (!is_array($attribute) || ($attribute['category'] ?? '') !== 'normal' || ($attribute['type'] ?? '') !== 'text') continue;
            $name = $attribute['name'] ?? null;
            if (!is_string($name) || in_array($name, ['FIRSTNAME', 'LASTNAME', 'EMAIL'], true)) continue;
            $options[] = ['value' => $name, 'label' => $name];
        }
        return $options;
    }

    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $email = $subject->values[CanonicalFields::EMAIL] ?? '';
        if (!is_email($email)) return PushResult::terminal(__('This submission has no valid email address.', 'wconvert'));
        $lists = DestinationRequirements::ids($context->settings['lists'] ?? null);
        if (count($lists) !== 1 || !ctype_digit($lists[0])) return PushResult::attention(__('Choose one Brevo list.', 'wconvert'));
        $listId = (int) $lists[0];
        $attributes = [];
        if (isset($subject->values[CanonicalFields::NAME])) $attributes['FIRSTNAME'] = $subject->values[CanonicalFields::NAME];
        foreach ($subject->mapped as $key => $value) {
            if (preg_match('/^[A-Z][A-Z0-9_]{0,31}$/D', $key) && !in_array($key, ['FIRSTNAME', 'LASTNAME', 'EMAIL'], true)) $attributes[$key] = $value;
        }
        // Enquiries may be stored as Contacts but must not enter a marketing list.
        $marketing = $subject->purpose === 'email_marketing';
        $payload = ['email' => $email, 'updateEnabled' => false];
        if ($marketing) $payload['listIds'] = [$listId];
        if ($attributes !== []) $payload['attributes'] = $attributes;
        try {
            [$status, $body] = $this->request($context->credentials, 'POST', '/contacts', $payload);
            if ($status >= 200 && $status < 300 && $status !== 204) return PushResult::success();
            if ($status === 204 || ($status === 400 && ($body['code'] ?? '') === 'duplicate_parameter')) {
                if (($context->settings['existing_contact'] ?? 'keep') === 'update') {
                    $change = $marketing ? ['listIds' => [$listId]] : [];
                    if ($attributes !== []) $change['attributes'] = $attributes;
                    if ($change === []) return PushResult::success();
                    [$updated] = $this->request($context->credentials, 'PUT', '/contacts/' . rawurlencode($email), $change);
                    return $updated >= 200 && $updated < 300 ? PushResult::success() : $this->failure($updated);
                }
                if (!$marketing) return PushResult::success();
                [$joined, $detail] = $this->request($context->credentials, 'POST', '/contacts/lists/' . $listId . '/contacts/add', ['emails' => [$email]]);
                return $joined >= 200 && $joined < 300 && empty($detail['failure']) ? PushResult::success() : $this->failure($joined);
            }
            return $this->failure($status);
        } catch (\Throwable $failure) {
            return PushResult::retryable(__('Brevo could not be reached. The result may be uncertain.', 'wconvert'));
        }
    }

    private function failure(int $status): PushResult
    {
        if ($status === 401 || $status === 403) return PushResult::attention(__('Brevo access was refused. Check this account.', 'wconvert'));
        if ($status === 429 || $status >= 500) return PushResult::retryable(__('Brevo is temporarily unavailable.', 'wconvert'));
        return PushResult::terminal(__('Brevo rejected this contact or list.', 'wconvert'));
    }

    /** @param array<string, mixed> $credentials
     * @param array<string, mixed>|null $body
     * @return array{int, array<string, mixed>}
     */
    private function request(array $credentials, string $method, string $path, ?array $body = null): array
    {
        $key = $credentials['api_key'] ?? '';
        if (!is_string($key) || $key === '') throw new \RuntimeException('Missing Brevo key.');
        $args = ['method' => $method, 'timeout' => 12, 'redirection' => 0,
            'headers' => ['api-key' => $key, 'Accept' => 'application/json']];
        if ($body !== null) {
            $args['headers']['Content-Type'] = 'application/json';
            $args['body'] = wp_json_encode($body);
        }
        $response = wp_remote_request('https://api.brevo.com/v3' . $path, $args);
        if (is_wp_error($response)) throw new \RuntimeException('Brevo transport failed.');
        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
        return [(int) wp_remote_retrieve_response_code($response), is_array($decoded) ? $decoded : []];
    }
}
