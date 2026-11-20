<?php

namespace WConvert\Tests\Unit\Onboarding;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Onboarding\ReviewAsk;
use WConvert\Rest\ReviewAskController;
use WConvert\Rest\Routes;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

#[CoversClass(ReviewAsk::class)]
#[CoversClass(ReviewAskController::class)]
final class ReviewAskTest extends TestCase
{
    private const NOW = 1_800_000_000;

    private int $scans = 0;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestUserMeta'] = [];
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestFilters'] = [];
        $GLOBALS['wconvertTestUserId'] = 7;
        $this->scans = 0;
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestUserId']);
        $GLOBALS['wconvertTestFilters'] = [];
    }

    /** @return callable(): ?string */
    private function converted(?string $day = '2026-11-20'): callable
    {
        return function () use ($day): ?string {
            $this->scans++;

            return $day;
        };
    }

    public function testNothingShowsBeforeTheFirstConversion(): void
    {
        $this->assertNull((new ReviewAsk())->state(7, $this->converted(null), self::NOW));
    }

    public function testTheFirstConversionBringsTheFirstLook(): void
    {
        $this->assertSame('first', (new ReviewAsk())->state(7, $this->converted(), self::NOW));
    }

    public function testMaybeLaterHidesItForThirtyDaysThenShowsTheLastLookOnce(): void
    {
        $ask = new ReviewAsk();
        $ask->record(7, 'later', self::NOW);

        $this->assertNull($ask->state(7, $this->converted(), self::NOW + ReviewAsk::WAIT - 1));
        $this->assertSame('last', $ask->state(7, $this->converted(), self::NOW + ReviewAsk::WAIT));
        $this->assertSame(0, $this->scans, 'A user who answered never costs a stats scan.');

        $ask->record(7, 'declined', self::NOW + ReviewAsk::WAIT);
        $this->assertNull($ask->state(7, $this->converted(), self::NOW + 10 * ReviewAsk::WAIT));
    }

    public function testASecondLaterCountsAsNoThanks(): void
    {
        $ask = new ReviewAsk();
        $ask->record(7, 'later', self::NOW);
        $ask->record(7, 'later', self::NOW + ReviewAsk::WAIT);

        $this->assertNull($ask->state(7, $this->converted(), self::NOW + 10 * ReviewAsk::WAIT));
    }

    public function testRatingOrDecliningEndsItForGood(): void
    {
        foreach (['rated', 'declined'] as $choice) {
            $GLOBALS['wconvertTestUserMeta'] = [];
            $ask = new ReviewAsk();
            $ask->record(7, $choice, self::NOW);

            $this->assertNull($ask->state(7, $this->converted(), self::NOW + 10 * ReviewAsk::WAIT), $choice);
        }

        $this->assertSame(0, $this->scans);
    }

    public function testAFinalAnswerCannotBeUndoneByALaterFromAnotherTab(): void
    {
        $ask = new ReviewAsk();
        $ask->record(7, 'declined', self::NOW);
        $ask->record(7, 'later', self::NOW + 60);

        $this->assertNull($ask->state(7, $this->converted(), self::NOW + 10 * ReviewAsk::WAIT));
    }

    public function testEachUserDecidesForThemselves(): void
    {
        $ask = new ReviewAsk();
        $ask->record(7, 'declined', self::NOW);

        $this->assertNull($ask->state(7, $this->converted(), self::NOW));
        $this->assertSame('first', $ask->state(8, $this->converted(), self::NOW));
        $this->assertNull($ask->state(0, $this->converted(), self::NOW), 'Nobody logged in is never asked.');
    }

    public function testAnUnknownChoiceStoresNothing(): void
    {
        $ask = new ReviewAsk();
        $ask->record(7, 'five-stars', self::NOW);

        $this->assertSame([], $GLOBALS['wconvertTestUserMeta']);
    }

    public function testTheFilterTurnsItOff(): void
    {
        add_filter(ReviewAsk::FILTER, static fn (): bool => false);

        $this->assertNull((new ReviewAsk())->state(7, $this->converted(), self::NOW));
        $this->assertSame(0, $this->scans);
    }

    public function testTheFirstConversionIsScannedOnceFoundAndHourlyUntilThen(): void
    {
        $GLOBALS['wconvertTestTransients'] = [];
        $days = [null, '2026-11-20'];
        $scan = function () use (&$days): ?string {
            $this->scans++;

            return array_shift($days);
        };

        $this->assertNull(ReviewAsk::firstConversion($scan));
        $this->assertNull(ReviewAsk::firstConversion($scan), 'None yet is remembered for an hour.');
        $this->assertSame(1, $this->scans);

        unset($GLOBALS['wconvertTestTransients'][ReviewAsk::CACHE]); // The hour is up.
        $this->assertSame('2026-11-20', ReviewAsk::firstConversion($scan));
        $this->assertSame('2026-11-20', ReviewAsk::firstConversion($scan));
        $this->assertSame(2, $this->scans, 'A found day is never scanned for again.');

        $GLOBALS['wconvertTestTransients'] = null;
    }

    public function testTheRouteRecordsTheCurrentUsersChoiceForManagersOnly(): void
    {
        $controller = new ReviewAskController(new ReviewAsk());
        $controller->registerRoutes();

        $route = $GLOBALS['wconvertTestRoutes'][0];
        $this->assertSame('/review-ask', $route['route']);
        $this->assertSame('POST', $route['args']['methods']);
        $this->assertSame([Routes::class, 'canManage'], $route['args']['permission_callback']);
        $this->assertSame(ReviewAsk::CHOICES, $route['args']['args']['choice']['enum']);

        $GLOBALS['wconvertTestCapabilities'] = [];
        $this->assertFalse(Routes::canManage(), 'Someone who cannot manage WConvert is refused.');
        $GLOBALS['wconvertTestCapabilities'] = [Routes::MANAGE_CAPABILITY];
        $this->assertTrue(Routes::canManage());
        $GLOBALS['wconvertTestCapabilities'] = [];

        $request = new WP_REST_Request('POST', '/wconvert/v1/review-ask');
        $request->set_param('choice', 'declined');
        $response = $controller->record($request);
        $this->assertInstanceOf(WP_REST_Response::class, $response);
        $this->assertSame(['choice' => 'declined'], $response->get_data());
        $this->assertNull((new ReviewAsk())->state(7, $this->converted(), self::NOW));
    }

    public function testTheRouteRefusesABadChoice(): void
    {
        $request = new WP_REST_Request('POST', '/wconvert/v1/review-ask');
        $request->set_param('choice', 'five-stars');

        $result = (new ReviewAskController(new ReviewAsk()))->record($request);

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame(400, $result->get_error_data()['status']);
        $this->assertSame([], $GLOBALS['wconvertTestUserMeta']);
    }
}
