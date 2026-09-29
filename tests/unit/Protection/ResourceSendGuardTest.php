<?php
namespace WConvert\Tests\Unit\Protection;

use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushOutcome;
use WConvert\Protection\ResourceSendGuard;
use WConvert\Protection\Diagnostics;
use WConvert\Tests\Unit\Support\FakeTransientStore;

final class ResourceSendGuardTest extends TestCase
{
    public function testItSuppressesRecentSendsWithoutCallingTheMailer(): void
    {
        $db = $this->createMock(Connection::class);
        $db->method('transaction')->willReturnCallback(static fn ($work) => $work());
        $db->method('row')->willReturn(['option_value' => json_encode(['expires' => time() + 500])]);
        $db->expects(self::never())->method('update');
        $diagnostics = new Diagnostics(new FakeTransientStore());
        $guard = new ResourceSendGuard($db, $diagnostics);
        $result = $guard->send('person@example.com', 'https://site.test/guide', static function () { self::fail('Must not send twice'); });
        self::assertSame(PushOutcome::Skipped, $result->outcome);
        self::assertSame(1, $diagnostics->read()['counts']['send_limited']);
    }

    public function testOnlySuccessfulMailReservesTheWindowAndKeysContainNoPersonalData(): void
    {
        foreach ([true, false] as $success) {
            $db = $this->createMock(Connection::class);
            $db->method('transaction')->willReturnCallback(static fn ($work) => $work());
            $db->method('row')->willReturn(['option_value' => '{"expires":0}']);
            $db->expects(self::once())->method('upsert')->with(Connection::TABLE_OPTIONS, self::anything(),
                self::callback(static fn ($key) => preg_match('/^wconvert_mail_[a-f0-9]{64}$/', $key) === 1), self::anything(), 'off');
            $db->expects($success ? self::once() : self::never())->method('update');
            $guard = new ResourceSendGuard($db, new Diagnostics(new FakeTransientStore()));
            $result = $guard->send('person@example.com', 'https://site.test/guide', static fn () => $success ? PushResult::success() : PushResult::retryable('Mailer unavailable'));
            self::assertSame($success ? PushOutcome::Success : PushOutcome::Failed, $result->outcome);
        }
    }
}
