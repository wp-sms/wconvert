<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\KeySource;
use WConvert\Pro\License\LicenseController;
use WConvert\Tests\Unit\Support\FakeTransientStore;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * P1: a key in wp-config.php. Nothing on the page can change the licence, and
 * nothing the browser receives names its sites, buyer, plan or dates.
 *
 * In separate processes, because a constant cannot be undefined again.
 */
#[CoversClass(LicenseController::class)]
#[RunTestsInSeparateProcesses]
final class ManagedLicenseControllerTest extends TestCase
{
    use FakesNexus;

    protected function setUp(): void
    {
        define('WCONVERT_LICENSE_KEY', 'WCV-AGEN-CY00-0001');
        define('WCONVERT_LICENSE_CONTACT', 'Acme Studio <help@acme.studio>');
        $this->fakeNexus();
        $this->freshSdk()->licenseManager()->activate('WCV-AGEN-CY00-0001', KeySource::CONSTANT);
    }

    protected function tearDown(): void
    {
        $this->stopFakingNexus();
    }

    public function testEveryChangeIsRefusedWithTheReason(): void
    {
        $controller = new LicenseController($this->freshSdk(), new FakeTransientStore());
        $request = new WP_REST_Request('POST', '/wconvert/v1/license');
        $request->set_param('key', 'WCV-OTHER');
        $request->set_param('domain', 'shop.example.com');
        $request->set_param('license_id', 1);

        foreach ([
            'activate' => $controller->activate($request),
            'replace' => $controller->replace($request),
            'remove' => $controller->remove(),
            'removeSite' => $controller->removeSite($request),
            'move' => $controller->move($request),
            'signIn' => $controller->signIn(),
            'choose' => $controller->choose($request),
            'signOut' => $controller->signOut(),
        ] as $route => $answer) {
            $this->assertInstanceOf(WP_Error::class, $answer, $route);
            $this->assertSame('key_from_constant', $answer->get_error_code(), $route);
            $this->assertSame(403, $answer->get_error_data()['status'], $route);
        }

        $this->assertSame([], $this->nexusCallsTo('/api/v1/license/deactivate'), 'a refused change still reached the store');
    }

    public function testTheStateCarriesNoSitesBuyerOrDates(): void
    {
        $response = (new LicenseController($this->freshSdk(), new FakeTransientStore()))->show(new WP_REST_Request('GET', '/wconvert/v1/license'));

        $this->assertInstanceOf(WP_REST_Response::class, $response);
        $data = $response->get_data();
        $json = (string) json_encode($data);

        $this->assertSame('active', $data['state']);
        $this->assertSame(['by' => 'Acme Studio', 'email' => 'help@acme.studio'], $data['managed']);
        $this->assertSame([], $data['sites']);
        $this->assertNull($data['buyer']);
        $this->assertNull($data['expires_at']);
        $this->assertStringNotContainsString('AGEN', $json);
        $this->assertDoesNotMatchRegularExpression('/\d{4}-\d{2}-\d{2}/', $json, 'a date reached the client');
    }

    /** Site Health, Plugins row and badge stay quiet about a managed licence's details. */
    public function testSiteHealthAndThePluginsScreenSayNothingAboutTheDetails(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $fields = (new \WConvert\Pro\License\SiteHealth($this->freshSdk()))->addSection([])[\WConvert\Pro\License\SiteHealth::SECTION]['fields'];

        $this->assertSame(['status', 'updates', 'key_source', 'managed_by'], array_keys($fields));

        $screen = new \WConvert\Pro\License\PluginsScreen($this->freshSdk(), 'wconvert-pro/wconvert-pro.php');
        ob_start();
        $screen->row();
        $this->assertSame('', ob_get_clean());
        $this->assertArrayNotHasKey('license', $screen->actionLinks([]));
    }
}
