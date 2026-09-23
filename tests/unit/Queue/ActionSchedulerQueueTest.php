<?php

namespace WConvert\Tests\Unit\Queue;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Queue\ActionSchedulerQueue;
use WConvert\Queue\QueueFailure;

#[CoversClass(ActionSchedulerQueue::class)]
final class ActionSchedulerQueueTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActionSchedulerId'] = 1;
        $GLOBALS['wconvertTestScheduledActions'] = [];
    }

    public function testAZeroActionIdReportsThatImmediateDispatchFailed(): void
    {
        $GLOBALS['wconvertTestActionSchedulerId'] = 0;

        $this->expectException(QueueFailure::class);
        $this->expectExceptionMessage('WConvert could not enqueue a scheduled action.');

        (new ActionSchedulerQueue())->dispatch('wconvert_push_destination', ['lead' => '01J']);
    }

    public function testAZeroActionIdReportsThatDelayedSchedulingFailed(): void
    {
        $GLOBALS['wconvertTestActionSchedulerId'] = 0;

        $this->expectException(QueueFailure::class);

        (new ActionSchedulerQueue())->schedule(time() + 60, 'wconvert_push_destination', ['lead' => '01J']);
    }

    public function testAPositiveActionIdIsAccepted(): void
    {
        $queue = new ActionSchedulerQueue();

        $queue->dispatch('wconvert_push_destination', ['lead' => '01J']);
        $queue->schedule(time() + 60, 'wconvert_push_destination', ['lead' => '01J']);

        self::assertCount(2, $GLOBALS['wconvertTestScheduledActions']);
    }
}
