<?php

namespace WConvert\Pro\License;

use Throwable;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Account\AccountClient;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Http\ApiClient;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Http\ApiException;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\ActivationVetoedException;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\LicenseActionException;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\LicenseErrorCode;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Support\Request;
use WConvert\Rest\Routes;
use WConvert\Storage\TransientStore;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * `wconvert/v1/license` — the License page's one door to the licence.
 *
 * The SDK offers admin-ajax endpoints; they are unhooked (ADR 0143, decision
 * 2) and this wraps the SDK's public manager methods instead, so the page sits
 * on the same REST, nonce and capability as every other WConvert screen. Two
 * things the SDK's endpoint classes carry are copied here rather than lost:
 *
 * - **the managed-key refusal** — with a key in wp-config.php every route that
 *   changes the licence answers 403 `key_from_constant`;
 * - **the updater flush** after activate, remove, move and replace, so the
 *   Plugins screen does not wait out a 12-hour cache.
 *
 * Every answer is {@see LicenseState}'s payload, so the page re-renders from
 * one shape. Errors are `WP_Error`s carrying the SDK's or the store's own
 * `error_code`; the page maps codes to copy, and an unknown one is shown with
 * its code rather than as nothing (P6).
 *
 * **No raw key reaches the browser** — the account's licences are listed by
 * id and chosen by id, and the key is looked up again here.
 *
 * @since 0.1.0
 */
final class LicenseController
{
    /** The page's focus refresh asks at most this often (seconds). */
    public const CHECK_EVERY = 60;

    private const CHECK_THROTTLE = 'wconvert_pro_license_checked';

    public function __construct(
        private readonly PremiumServiceProvider $sdk,
        private readonly TransientStore $transients,
    ) {
    }

    public function registerRoutes(): void
    {
        $route = static fn (string $path, string $methods, callable $callback, array $args = []): bool => register_rest_route(
            Routes::NAMESPACE,
            '/license' . $path,
            [[
                'methods' => $methods,
                'callback' => $callback,
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => $args,
            ]]
        );

        $route('', 'GET', [$this, 'show'], ['check' => ['type' => 'boolean', 'default' => false]]);
        $route('/activate', 'POST', [$this, 'activate'], ['key' => ['type' => 'string', 'required' => true]]);
        $route('/replace', 'POST', [$this, 'replace'], ['key' => ['type' => 'string', 'required' => true]]);
        $route('', 'DELETE', [$this, 'remove']);
        $route('/sites/(?P<domain>[A-Za-z0-9.\-:]+)', 'DELETE', [$this, 'removeSite']);
        $route('/move', 'POST', [$this, 'move'], ['keep_old' => ['type' => 'boolean', 'default' => false]]);
        $route('/updates/check', 'POST', [$this, 'checkUpdates']);
        $route('/account/sign-in', 'POST', [$this, 'signIn']);
        $route('/account', 'GET', [$this, 'account']);
        $route('/account/choose', 'POST', [$this, 'choose'], ['license_id' => ['type' => 'integer', 'required' => true]]);
        $route('/account', 'DELETE', [$this, 'signOut']);
    }

    /**
     * The state from what is stored. With `?check=1` — the page coming back
     * into focus, or Check now — the store is asked first, at most once a
     * minute per site whoever asks (veronalabs/wp-premium-sdk#39).
     */
    public function show(WP_REST_Request $request): WP_REST_Response
    {
        $manager = $this->sdk->licenseManager();

        if ($request->get_param('check') && $manager->isActivated() && $this->transients->get(self::CHECK_THROTTLE) === null) {
            $this->transients->set(self::CHECK_THROTTLE, time(), self::CHECK_EVERY);
            $manager->refreshStatus();
            $manager->refreshSites();
        }

        return new WP_REST_Response($this->state());
    }

    /** @return WP_REST_Response|WP_Error */
    public function activate(WP_REST_Request $request)
    {
        return $this->changing(function () use ($request): array {
            $this->sdk->licenseManager()->activate(self::cleanKey((string) $request->get_param('key')));

            return [];
        });
    }

    /**
     * Swap this site's key for another, without a gap in updates and without
     * orphaning the old seat (veronalabs/wp-premium-sdk#30): the new key is
     * activated first, and only then is the old one's seat released.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function replace(WP_REST_Request $request)
    {
        return $this->changing(function () use ($request): array {
            $manager = $this->sdk->licenseManager();
            $old = $manager->getLicenseKey();
            $new = self::cleanKey((string) $request->get_param('key'));

            $manager->activate($new);

            $released = ['removed_remotely' => true, 'error_code' => null];

            if ($old !== null && $old !== $new) {
                $released = $manager->releaseSeat($old, Request::currentDomain());
            }

            return ['released' => $released];
        });
    }

    /**
     * Remove the licence from this site: the seat is released when the store
     * answers, and the licence is forgotten here either way (L3).
     *
     * @return WP_REST_Response|WP_Error
     */
    public function remove()
    {
        return $this->changing(function (): array {
            return ['released' => $this->sdk->licenseManager()->deactivate(PremiumServiceProvider::UNINSTALL_TIMEOUT)];
        });
    }

    /** @return WP_REST_Response|WP_Error */
    public function removeSite(WP_REST_Request $request)
    {
        $domain = (string) $request->get_param('domain');
        $manager = $this->sdk->licenseManager();

        if (!$manager->isActivated()) {
            return self::error(LicenseErrorCode::NOT_ACTIVATED, 409);
        }

        if ($manager->isThisSite($domain)) {
            return self::error('this_site', 409);
        }

        return $this->changing(function () use ($manager, $domain): array {
            $manager->removeSite($domain);

            return [];
        });
    }

    /**
     * This site moved domains (C1, C3): activate it here, and release the old
     * domain's seat unless the merchant keeps both.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function move(WP_REST_Request $request)
    {
        return $this->changing(function () use ($request): array {
            $result = $this->sdk->licenseManager()->moveLicense(!$request->get_param('keep_old'));

            return ['released' => $result['released']];
        });
    }

    /** Ask the store now, and have WordPress rebuild its update list from the answer. */
    public function checkUpdates(): WP_REST_Response
    {
        $this->sdk->pluginUpdater()->fetchManifest(true);
        delete_site_transient('update_plugins');
        wp_update_plugins();

        return new WP_REST_Response(['updates' => $this->state()['updates']]);
    }

    /** @return WP_REST_Response|WP_Error */
    public function signIn()
    {
        if ($this->managed()) {
            return self::error(LicenseErrorCode::KEY_FROM_CONSTANT, 403);
        }

        $authorize = $this->sdk->accountManager()->getAuthorizeUrl(admin_url('admin.php?page=wconvert#license'));

        return new WP_REST_Response(['url' => $authorize['authorize_url']]);
    }

    /**
     * The signed-in account and its licences for this product — masked keys,
     * and whether each still has a site free. Read fresh from the store, never
     * from the pending choice the SDK keeps raw keys in (#36).
     *
     * @return WP_REST_Response|WP_Error
     */
    public function account()
    {
        $account = $this->sdk->accountManager();
        $user = $account->getUser();
        $flash = $account->consumeFlashError();

        if ($user === null) {
            return new WP_REST_Response(['signed_in' => false, 'email_masked' => null, 'licenses' => [], 'error_code' => null, 'message' => $flash]);
        }

        try {
            $licenses = $this->accountLicenses();
        } catch (Throwable $e) {
            if ($account->isSignInExpired($e)) {
                $account->clearSession();

                return new WP_REST_Response(['signed_in' => false, 'email_masked' => null, 'licenses' => [], 'error_code' => LicenseErrorCode::ACCOUNT_EXPIRED, 'message' => null]);
            }

            return self::fromException($e);
        }

        $here = Request::normaliseDomain(Request::currentDomain());

        return new WP_REST_Response([
            'signed_in' => true,
            'email_masked' => self::maskEmail((string) $user['email']),
            'licenses' => array_values(array_map(static fn (array $license): array => self::accountLicense($license, $here), $licenses)),
            'error_code' => null,
            'message' => $flash,
        ]);
    }

    /** @return WP_REST_Response|WP_Error */
    public function choose(WP_REST_Request $request)
    {
        $id = (int) $request->get_param('license_id');

        return $this->changing(function () use ($id): array {
            foreach ($this->accountLicenses() as $license) {
                if ((int) ($license['id'] ?? 0) === $id && !empty($license['license_key'])) {
                    $this->sdk->licenseManager()->activate((string) $license['license_key']);
                    $this->sdk->accountManager()->endSignIn();

                    return [];
                }
            }

            throw new LicenseActionException('license_not_on_account', 'That licence is not on this account.');
        });
    }

    public function signOut(): WP_REST_Response
    {
        $this->sdk->accountManager()->logout();

        return new WP_REST_Response(['signed_in' => false]);
    }

    /**
     * Run a change to the licence: refused outright with a wp-config key, the
     * update caches flushed after, the new state returned with whatever the
     * change reports beside it.
     *
     * @param callable(): array<string, mixed> $change
     * @return WP_REST_Response|WP_Error
     */
    private function changing(callable $change)
    {
        if ($this->managed()) {
            return self::error(LicenseErrorCode::KEY_FROM_CONSTANT, 403);
        }

        try {
            $extra = $change();
        } catch (Throwable $e) {
            return self::fromException($e);
        } finally {
            $this->sdk->pluginUpdater()->flush();
        }

        return new WP_REST_Response($this->state() + $extra);
    }

    /** @return array<string, mixed> */
    private function state(): array
    {
        return LicenseState::payload(LicenseFacts::fromSite($this->sdk));
    }

    private function managed(): bool
    {
        return $this->sdk->keySource()->constantKey() !== null;
    }

    /**
     * @return list<array<string, mixed>>
     * @throws Throwable
     */
    private function accountLicenses(): array
    {
        $token = $this->sdk->accountManager()->getAccessToken();

        if ($token === null) {
            throw new LicenseActionException(LicenseErrorCode::ACCOUNT_EXPIRED, 'The sign-in has ended.');
        }

        $config = $this->sdk->config();
        $response = (new AccountClient($config, new ApiClient($config)))->licenses($token);
        $licenses = $response['data'] ?? $response['licenses'] ?? [];

        return array_values(array_filter(is_array($licenses) ? $licenses : [], 'is_array'));
    }

    /**
     * One of the account's licences, as the chooser shows it.
     *
     * @param array<string, mixed> $license As Nexus's `formatLicenseDetailed()` sends it.
     * @return array<string, mixed>
     */
    private static function accountLicense(array $license, string $here): array
    {
        $sites = is_array($license['activations'] ?? null) ? $license['activations'] : [];
        $counted = array_filter($sites, static fn ($site): bool => is_array($site) && ($site['is_counted'] ?? true) !== false);
        $hereAlready = array_filter($sites, static fn ($site): bool => is_array($site) && Request::normaliseDomain((string) ($site['domain'] ?? '')) === $here);
        $max = (int) ($license['activation_limit'] ?? 0);
        $used = count($counted);

        return [
            'id' => (int) ($license['id'] ?? 0),
            'plan' => (string) ($license['type'] ?? ''),
            'status' => (string) ($license['status'] ?? ''),
            'key_masked' => '••••' . strtoupper(substr((string) preg_replace('/[^A-Z0-9]/i', '', (string) ($license['license_key'] ?? '')), -4)),
            'ends_at' => is_string($license['expires_at'] ?? null) ? $license['expires_at'] : null,
            'used' => $used,
            'max' => $max > 0 ? $max : null,
            'here' => $hereAlready !== [],
            // Full only for a site that is not already on it.
            'full' => $max > 0 && $used >= $max && $hereAlready === [],
        ];
    }

    /**
     * A pasted key, cleaned: no spaces, every dash-like character a hyphen,
     * upper case — the prototype's `cleanKey()`.
     */
    public static function cleanKey(string $raw): string
    {
        $key = strtoupper((string) preg_replace('/\s+/u', '', $raw));
        $key = (string) preg_replace('/[\x{2010}-\x{2015}\x{2212}\x{FE58}\x{FE63}\x{FF0D}_]/u', '-', $key);
        $key = (string) preg_replace('/-{2,}/', '-', $key);

        return trim($key, '-');
    }

    private static function maskEmail(string $email): string
    {
        $at = strrpos($email, '@');

        return $at === false ? '' : mb_substr($email, 0, 1) . '***' . substr($email, $at);
    }

    private static function fromException(Throwable $e): WP_Error
    {
        if ($e instanceof ApiException) {
            $status = $e->getHttpStatus();
            $code = $e->getErrorCode();

            return self::error($code, match (true) {
                $code === LicenseErrorCode::RATE_LIMITED => 429,
                $status >= 400 && $status < 500 => $status,
                default => 502,
            }, ['retry_after' => $e->getRetryAfter()], $e->getMessage());
        }

        if ($e instanceof ActivationVetoedException) {
            return self::error('activation_vetoed', 409, ['removed_remotely' => $e->removedRemotely()], $e->getMessage());
        }

        if ($e instanceof LicenseActionException) {
            $code = $e->getErrorCode();

            return self::error($code, in_array($code, [LicenseErrorCode::KEY_FROM_CONSTANT, LicenseErrorCode::NETWORK_MANAGED], true) ? 403 : 409, $e->getExtra(), $e->getMessage());
        }

        return self::error(LicenseErrorCode::UNKNOWN, 500, [], $e->getMessage());
    }

    /** @param array<string, mixed> $data */
    private static function error(string $code, int $status, array $data = [], string $message = ''): WP_Error
    {
        return new WP_Error($code, $message !== '' ? $message : $code, ['status' => $status] + $data);
    }
}
