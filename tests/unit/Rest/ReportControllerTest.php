<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Report\SummaryMailer;
use WConvert\Report\WeeklySummaryJob;
use WConvert\Report\WeeklySummarySettings;
use WConvert\Rest\ReportController;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WP_Error;
use WP_REST_Request;

#[CoversClass(ReportController::class)]
final class ReportControllerTest extends TestCase
{
    private FakeOptionStore $options;

    private bool $mailWorks = true;

    /** @var list<list<string>> */
    private array $sentTo = [];

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestSchedule'] = [];
        $this->options = new FakeOptionStore();
        $this->options->set('admin_email', 'owner@example.com');
    }

    public function testDefaultsShowTheAdminEmailAndThatItWaitsForAPublish(): void
    {
        $data = $this->controller()->show()->get_data();

        $this->assertTrue($data['enabled']);
        $this->assertSame('owner@example.com', $data['recipients']);
        $this->assertTrue($data['waiting_for_publish']);
        $this->assertNull($data['next_send']);
    }

    public function testSavingRejectsABadAddressAndNamesIt(): void
    {
        $result = $this->controller()->update($this->request(['enabled' => true, 'recipients' => 'a@example.com, nope']));

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('Check these addresses: nope', $result->get_error_message());
        $this->assertTrue((new WeeklySummarySettings($this->options))->recipients() === ['owner@example.com'], 'Nothing was saved.');
    }

    public function testSavingOffWithNoAddressIsAllowed(): void
    {
        $response = $this->controller()->update($this->request(['enabled' => false, 'recipients' => '']));
        $this->assertInstanceOf(\WP_REST_Response::class, $response);
        $data = $response->get_data();

        $this->assertFalse($data['enabled']);
    }

    public function testATestGoesToTheAddressesTypedEvenUnsaved(): void
    {
        $response = $this->controller()->test($this->request(['recipients' => 'me@example.com, you@example.com']));
        $this->assertInstanceOf(\WP_REST_Response::class, $response);
        $data = $response->get_data();

        $this->assertSame(['me@example.com', 'you@example.com'], $data['to']);
        $this->assertSame([['me@example.com', 'you@example.com']], $this->sentTo);
    }

    public function testAFailedSendSaysToCheckTheSitesEmail(): void
    {
        $this->mailWorks = false;

        $result = $this->controller()->test($this->request(['recipients' => 'me@example.com']));

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('wconvert_summary_not_sent', $result->get_error_code());
    }

    /** @param array<string, mixed> $params */
    private function request(array $params): WP_REST_Request
    {
        $request = new WP_REST_Request('POST', '/wconvert/v1/reports/weekly');

        foreach ($params as $key => $value) {
            $request->set_param($key, $value);
        }

        return $request;
    }

    private function controller(): ReportController
    {
        $db = new FakeConnection();
        $test = $this;
        $mailer = new class ($test) implements SummaryMailer {
            public function __construct(private readonly ReportControllerTest $test)
            {
            }

            public function send(array $to, string $subject, string $html, string $text): bool
            {
                return $this->test->record($to);
            }
        };
        $settings = new WeeklySummarySettings($this->options);
        $milestones = new MilestoneStore($this->options);
        $job = new WeeklySummaryJob(
            new Dashboard(new StatsRepository($db), new OptinRepository($db, new PublishedSet($this->options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), $milestones)),
            $milestones,
            $settings,
            $mailer
        );

        return new ReportController($settings, $job, $milestones);
    }

    /** @param list<string> $to */
    public function record(array $to): bool
    {
        $this->sentTo[] = $to;

        return $this->mailWorks;
    }
}
