<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\TestCase;
use WConvert\Lead\CaptureConflict;
use WConvert\Lead\JourneyCapture;
use WConvert\Lead\QuestionCapture;
use WConvert\Lead\Submission;
use WConvert\Stats\StatsRepository;
use WConvert\Template\GraphCaptureContract;
use WConvert\Tests\Unit\Support\FakeConnection;

final class JourneyCaptureTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function tree(): array
    {
        $tree = \WConvert\Tests\Unit\Support\BundledJourney::tree('journey-email-then-sms');
        $tree['v'] = 2;
        $tree['steps'][0]['content']['children'][] = [
            'type' => 'question', 'id' => 'q_optional', 'label' => 'Your interest?', 'answer_type' => 'single',
            'required' => false, 'options' => [['value' => 'garden', 'label' => 'Garden'], ['value' => 'home', 'label' => 'Home']],
        ];
        $tree['graph'] = ['entry' => 'email', 'edges' => [
            ['id' => 'email_next', 'from' => 'email', 'to' => 'sms', 'kind' => 'default'],
            ['id' => 'sms_next', 'from' => 'sms', 'to' => 'received', 'kind' => 'default'],
        ]];
        self::assertNull(GraphCaptureContract::issue($tree, 'grow_email_list'));
        return $tree;
    }

    /** @param array<string, string> $firstAnswers
     * @param array<string, mixed>|null $tree
     * @return array{JourneyCapture, FakeConnection, array<string, mixed>, array{receipt: string, expires: int}, string, array<string, mixed>}
     */
    private static function firstCapture(array $firstAnswers, ?array $tree = null): array
    {
        $tree ??= self::tree();
        $db = new FakeConnection();
        $key = 'receipt_test';
        $grant = ['receipt' => $key, 'expires' => time() + 3600];
        $db->rows[$key] = ['option_value' => (string) wp_json_encode(['expires' => $grant['expires'], 'lead' => null])];
        $capture = new JourneyCapture($db, new StatsRepository($db));
        $first = self::primaryCapture($capture, $tree, $grant, $firstAnswers);
        $db->rows[$key] = ['option_value' => (string) wp_json_encode(['expires' => $grant['expires'], 'lead' => $first['id']])];
        return [$capture, $db, $tree, $grant, $first['id'], $first];
    }

    /** @param array<string, mixed> $tree
     * @param array{receipt: string, expires: int} $grant
     * @param array<string, string> $answers
     * @return array<string, mixed>
     */
    private static function primaryCapture(JourneyCapture $capture, array $tree, array $grant, array $answers): array
    {
        $snapshots = QuestionCapture::validate($tree, $answers, 'email-signup');
        self::assertIsArray($snapshots);
        return $capture->accept('optin_test', 'contract_test', $grant, $tree, 'email-signup',
            new Submission('visitor@example.com', null, ['consent_text' => 'Email consent'], $snapshots,
                ['page_url' => '/pricing?utm_source=fb', 'utm' => ['source' => 'fb', 'medium' => null, 'campaign' => null, 'term' => null, 'content' => null]]),
            ['purpose' => 'email_marketing', 'destination_ids' => []]);
    }

    /** @param array<string, mixed> $tree
     * @param array{receipt: string, expires: int} $grant
     * @param array<string, string> $answers
     * @return array{id: string, submission: string, first: bool, replay: bool}
     */
    private static function secondCapture(JourneyCapture $capture, array $tree, array $grant, array $answers): array
    {
        $snapshots = QuestionCapture::validate($tree, $answers, 'sms-signup');
        self::assertIsArray($snapshots);
        return $capture->accept('optin_test', 'contract_test', $grant, $tree, 'sms-signup',
            new Submission(null, '+12025550123', ['consent_text' => 'SMS consent'], $snapshots, ['page_url' => '/thanks', 'utm' => []]),
            ['purpose' => 'sms_marketing', 'destination_ids' => []]);
    }

    public function testTheLeadKeepsThePageItSignedUpOnAndALaterStepDoesNotMoveIt(): void
    {
        [$capture, $db, $tree, $grant, $leadId] = self::firstCapture([]);
        self::secondCapture($capture, $tree, $grant, []);
        $lead = \WConvert\Lead\Lead::fromRow($db->rows[$leadId]);
        self::assertSame('/pricing?utm_source=fb', $lead->capture['source']['page_url']);
        self::assertSame('/pricing?utm_source=fb', $lead->submission('sms-signup')?->capture['source']['page_url']);
    }

    public function testAcceptedOptionalBlankCannotBeFilledAtTheNextSave(): void
    {
        [$capture, $db, $tree, $grant, $leadId] = self::firstCapture([]);
        $fields = json_decode((string) $db->rows[$leadId]['fields'], true);
        self::assertSame(['q_optional'], $fields['capture']['submissions']['email-signup']['question_ids']);
        self::assertSame([], $fields['capture']['submissions']['email-signup']['question_answers']);
        $this->expectException(CaptureConflict::class);
        $this->expectExceptionMessage('fixed');
        self::secondCapture($capture, $tree, $grant, ['q_optional' => 'garden']);
    }

    public function testAcceptedAnswerCannotBeChangedAtTheNextSave(): void
    {
        [$capture, , $tree, $grant] = self::firstCapture(['q_optional' => 'garden']);
        $this->expectException(CaptureConflict::class);
        $this->expectExceptionMessage('fixed');
        self::secondCapture($capture, $tree, $grant, ['q_optional' => 'home']);
    }

    public function testUnchangedEarlierAnswerCanBeSubmittedWithOptionalSecondCapture(): void
    {
        [$capture, $db, $tree, $grant, $leadId] = self::firstCapture(['q_optional' => 'garden']);
        $second = self::secondCapture($capture, $tree, $grant, ['q_optional' => 'garden']);
        self::assertSame($leadId, $second['id']);
        self::assertFalse($second['replay']);
        $fields = json_decode((string) $db->rows[$leadId]['fields'], true);
        self::assertCount(2, $fields['capture']['submissions']);
        self::assertSame(['garden'], $fields['question_answers'][0]['values']);
    }

    /** The reward rides the primary signup and its replay, never the optional one (ADR 0164). */
    public function testThePrimarySignupAndItsReplayCarryTheRewardAndTheOptionalSignupDoesNot(): void
    {
        $tree = self::tree();
        $tree['steps'][2]['content']['children'][] = ['type' => 'code', 'text' => 'FRIDAY25'];
        [$capture, , , $grant, , $first] = self::firstCapture([], $tree);
        self::assertFalse($first['replay']);
        self::assertSame(['received' => [['text' => 'FRIDAY25']]], $first['reward']);

        $replay = self::primaryCapture($capture, $tree, $grant, []);
        self::assertTrue($replay['replay']);
        self::assertSame($first['reward'], $replay['reward']);

        self::assertArrayNotHasKey('reward', self::secondCapture($capture, $tree, $grant, []));
    }

    public function testADesignWithNothingHeldRepliesAsBefore(): void
    {
        [, , , , , $first] = self::firstCapture([]);
        self::assertArrayNotHasKey('reward', $first);
    }
}
