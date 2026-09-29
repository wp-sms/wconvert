<?php

namespace WConvert\Tests\Unit\Protection;

use PHPUnit\Framework\TestCase;
use WConvert\Protection\Settings;
use WConvert\Protection\Diagnostics;
use WConvert\Protection\Protection;
use WConvert\Protection\Verifier;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeTransientStore;
use WConvert\Lead\CaptureGrant;
use WConvert\Lead\Submission;
use WConvert\Pro\Module\SpamFilters\SpamFilters;
use WP_Error;

final class ProtectionTest extends TestCase
{
    protected function setUp(): void
    {
        if (!defined('WCONVERT_URL')) { define('WCONVERT_URL', 'https://example.test/wp-content/plugins/wconvert/'); }
    }

    protected function tearDown(): void
    {
        foreach (['wconvert_protection_rules_available', 'wconvert_protection_rule_fields', 'wconvert_protection_validate_rules', 'wconvert_protection_submission'] as $hook) { unset($GLOBALS['wconvertTestFilters'][$hook]); }
    }

    private function settings(string $provider = 'turnstile'): Settings
    {
        $settings = new Settings(new FakeOptionStore());
        self::assertNull($settings->save(['provider' => $provider, 'site_key' => 'public-key', 'secret' => 'secret-key']));
        return $settings;
    }

    public function testSecretsAreWriteOnlyAndProviderChangesCannotReuseThem(): void
    {
        $settings = $this->settings();
        self::assertStringNotContainsString('secret-key', (string) json_encode($settings->publicSettings()));
        self::assertTrue($settings->publicSettings()['has_secret']);
        self::assertNull($settings->save(['provider' => 'turnstile', 'site_key' => 'public-key', 'secret' => '']));
        self::assertSame('secret-key', $settings->read()['secret']);
        self::assertInstanceOf(WP_Error::class, $settings->save(['provider' => 'hcaptcha', 'site_key' => 'other', 'secret' => '']));
        self::assertSame('turnstile', $settings->read()['provider']);
        self::assertNull($settings->save(['provider' => 'none']));
        self::assertSame('', $settings->read()['secret']);
    }

    public function testEnablingOrRotatingProtectionInvalidatesOldGrants(): void
    {
        $settings = new Settings(new FakeOptionStore());
        $grants = new CaptureGrant('key');
        $old = $grants->issue('campaign', $settings->contract('contract'), time());
        $settings->save(['provider' => 'turnstile', 'site_key' => 'site', 'secret' => 'secret']);
        self::assertNull($grants->verify($old, 'campaign', $settings->contract('contract'), time()));
        $new = $grants->issue('campaign', $settings->contract('contract'), time());
        self::assertNotNull($grants->verify($new, 'campaign', $settings->contract('contract'), time()));
        $settings->save(['provider' => 'turnstile', 'site_key' => 'site', 'secret' => 'rotated']);
        self::assertNull($grants->verify($new, 'campaign', $settings->contract('contract'), time()));
    }

    public function testProvidersRequireTrueSuccessAndTheExpectedHostnameAndAction(): void
    {
        foreach (['turnstile', 'hcaptcha', 'recaptcha'] as $provider) {
            $settings = $this->settings($provider)->read();
            $reply = ['success' => true, 'hostname' => 'example.test', 'action' => 'wconvert_capture'];
            $calls = [];
            $verifier = new Verifier(static function ($url, $body) use (&$reply, &$calls) { $calls[] = [$url, $body]; return ['response' => ['code' => 200], 'body' => json_encode($reply)]; });
            self::assertNull($verifier->verify($settings, 'token', 'example.test'));
            self::assertArrayNotHasKey('remoteip', $calls[0][1]);
            self::assertArrayNotHasKey('email', $calls[0][1]);
            if ($provider === 'hcaptcha') { self::assertSame('public-key', $calls[0][1]['sitekey']); }
            $reply['hostname'] = 'other.test';
            if ($provider === 'hcaptcha') {
                self::assertNull($verifier->verify($settings, 'token', 'example.test'));
                $reply['hostname'] = 'not-provided';
                self::assertNull($verifier->verify($settings, 'token', 'example.test'));
                $reply['success'] = false; $reply['error-codes'] = ['sitekey-secret-mismatch'];
                self::assertSame('wconvert_verification_unavailable', $verifier->verify($settings, 'token', 'example.test')?->get_error_code());
                unset($reply['error-codes']);
            } else {
                self::assertSame('wconvert_verification_failed', $verifier->verify($settings, 'token', 'example.test')?->get_error_code());
            }
            $reply['hostname'] = 'example.test'; $reply['success'] = 'true';
            self::assertSame('wconvert_verification_unavailable', $verifier->verify($settings, 'token', 'example.test')?->get_error_code());
            $reply['success'] = true;
            if ($provider === 'turnstile') { $reply['action'] = 'login'; self::assertNotNull($verifier->verify($settings, 'token', 'example.test')); }
            if ($provider === 'recaptcha') { $reply['score'] = 0.1; self::assertSame('wconvert_verification_unavailable', $verifier->verify($settings, 'token', 'example.test')?->get_error_code()); }
        }
    }

    public function testOutagesAndBadCredentialsAreNotReportedAsSpam(): void
    {
        $settings = $this->settings()->read();
        foreach ([new WP_Error('timeout', 'secret-key'), ['response' => ['code' => 429], 'body' => 'secret-key'], ['response' => ['code' => 200], 'body' => 'not json'], ['response' => ['code' => 200], 'body' => json_encode(['success' => false, 'error-codes' => ['invalid-input-secret']])]] as $reply) {
            $error = (new Verifier(static fn () => $reply))->verify($settings, 'token', 'example.test');
            self::assertSame('wconvert_verification_unavailable', $error->get_error_code());
            self::assertStringNotContainsString('secret-key', $error->get_error_message());
        }
        $error = (new Verifier(static fn () => ['response' => ['code' => 200], 'body' => '{"success":false,"error-codes":["timeout-or-duplicate"]}']))->verify($settings, 'token', 'example.test');
        self::assertSame('wconvert_verification_failed', $error->get_error_code());
    }

    public function testChallengeDiscoveryDoesNotVerifyAndHoneypotsStoreOnlyCounts(): void
    {
        $diagnostics = new Diagnostics(new FakeTransientStore());
        $protection = new Protection($this->settings(), $diagnostics, new Verifier(static function () { self::fail('No token means no outbound request'); }));
        $challenge = $protection->start([]);
        self::assertIsArray($challenge);
        self::assertArrayHasKey('challenge', $challenge);
        self::assertNotNull($protection->honeypot(['website' => 'private@spam.test']));
        self::assertNull($protection->honeypot(['website' => '']));
        self::assertSame(['honeypot' => 1], $diagnostics->read()['counts']);
        self::assertStringNotContainsString('private', (string) json_encode($diagnostics->read()));
    }

    public function testProRulesHaveExactMatchesAndExceptionsWithoutBlockingNormalAddresses(): void
    {
        SpamFilters::hooks();
        $settings = $this->settings('none');
        self::assertNull($settings->save(['provider' => 'none', 'rules' => ['blocked_domains' => "EXAMPLE.COM\nexample.com", 'blocked_emails' => 'bad@gmail.com', 'allowed_emails' => 'good@example.com']]));
        $protection = new Protection($settings, new Diagnostics(new FakeTransientStore()), new Verifier());
        foreach (['good@example.com', 'someone@gmail.com', 'info@business.com', 'person@sub.example.com'] as $email) { self::assertNull($protection->submission(new Submission($email, null, []), 'campaign')); }
        self::assertNotNull($protection->submission(new Submission('bad@example.com', null, []), 'campaign'));
        self::assertNull($protection->submission(new Submission(null, '+15555555555', []), 'campaign'));
        unset($GLOBALS['wconvertTestFilters']['wconvert_protection_rules_available']);
        self::assertSame('wconvert_verification_unavailable', $protection->submission(new Submission('good@example.com', null, []), 'campaign')->get_error_code());
        self::assertNull($settings->save(['provider' => 'none', 'rules' => []]));
        self::assertNull($protection->submission(new Submission('good@example.com', null, []), 'campaign'));
    }

    public function testFreeCannotSavePaidRulesAndListsAreStrictlyValidated(): void
    {
        $settings = $this->settings('none');
        self::assertInstanceOf(WP_Error::class, $settings->save(['provider' => 'none', 'rules' => ['blocked_domains' => 'example.com']]));
        SpamFilters::hooks();
        foreach (['*.example.com', 'https://example.com', str_repeat('a', 64) . '.com'] as $domain) {
            self::assertInstanceOf(WP_Error::class, $settings->save(['provider' => 'none', 'rules' => ['blocked_domains' => $domain]]));
        }
    }
}
