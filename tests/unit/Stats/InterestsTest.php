<?php
namespace WConvert\Tests\Unit\Stats;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\Interests;
final class InterestsTest extends TestCase
{
    public function testChoiceQuestionsKeepTheirWordingAndExcludeFreeText(): void
    {
        $answer = ['id' => 'q1', 'question' => 'What do you need?', 'type' => 'multi', 'values' => ['a', 'b'], 'labels' => ['A', 'B']];
        $rows = [['fields' => json_encode(['question_answers' => [$answer, ['id' => 'q2', 'type' => 'text', 'values' => ['secret']]]], JSON_THROW_ON_ERROR)]];
        $result = Interests::summarize($rows);
        self::assertSame(1, $result['questions'][0]['answered']);
        self::assertCount(2, $result['questions'][0]['choices']);
        self::assertStringNotContainsString('secret', json_encode($result, JSON_THROW_ON_ERROR));
    }
    public function testOnlyExplicitRetainedChoicesAreCountedAndChangedLabelsStaySeparate(): void
    {
        $rows = [
            ['fields' => json_encode(['answers' => ['interest' => 'fit', 'interest_label' => 'Product fit', 'message' => 'private']], JSON_THROW_ON_ERROR)],
            ['fields' => json_encode(['answers' => ['interest' => 'fit', 'interest_label' => 'Product fit']], JSON_THROW_ON_ERROR)],
            ['fields' => json_encode(['answers' => ['interest' => 'fit', 'interest_label' => 'Fit consultation']], JSON_THROW_ON_ERROR)],
            ['fields' => json_encode(['answers' => ['message' => 'private']], JSON_THROW_ON_ERROR)],
        ];
        $result = Interests::summarize($rows);
        self::assertSame(3, $result['answered']);
        self::assertCount(2, $result['choices']);
        self::assertSame(2, $result['choices'][0]['count']);
        self::assertStringNotContainsString('private', json_encode($result, JSON_THROW_ON_ERROR));
    }
}
