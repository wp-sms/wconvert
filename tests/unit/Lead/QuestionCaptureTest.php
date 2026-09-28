<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\TestCase;
use WConvert\Lead\QuestionCapture;
use WConvert\Lead\Refusal;
use WConvert\Lead\RefusalCode;
use WConvert\Template\CaptureJourney;
use WConvert\Template\TemplateVocabulary;

final class QuestionCaptureTest extends TestCase
{
    /** @return array<string, mixed> */
    private function productTree(): array
    {
        $template = json_decode((string) file_get_contents(WCONVERT_DIR . '/pro/modules/journeys/templates/journey-product-finder.json'), true, 512, JSON_THROW_ON_ERROR);
        return TemplateVocabulary::fromManifest()->normalize($template)['tree'];
    }

    public function testAnonymousResultPathValidatesOnlyQuestionsTheVisitorSaw(): void
    {
        $tree = $this->productTree();
        self::assertNull(CaptureJourney::issue($tree));
        $answer = QuestionCapture::validate($tree, ['n3' => 'balcony', 'n6' => 'shade']);
        self::assertIsArray($answer);
        self::assertCount(1, $answer);
        self::assertSame('Where will you use it?', $answer[0]['question']);
        self::assertSame(['Balcony'], $answer[0]['labels']);
        self::assertSame('need', $answer[0]['screen']);
    }

    public function testRequiredActiveAnswerAndInvalidValueAreRefused(): void
    {
        $tree = $this->productTree();
        $missing = QuestionCapture::validate($tree, ['n3' => 'garden']);
        self::assertInstanceOf(Refusal::class, $missing);
        self::assertSame(RefusalCode::FieldRequired, $missing->code);
        self::assertSame('n6', $missing->field);
        $invalid = QuestionCapture::validate($tree, ['n3' => 'invented']);
        self::assertInstanceOf(Refusal::class, $invalid);
        self::assertSame(RefusalCode::ChoiceInvalid, $invalid->code);
    }

    public function testMalformedAnswerShapesAreRefusedBeforeEvaluatingConditions(): void
    {
        $tree = $this->productTree();
        // A malformed POST must produce a validation refusal, not a PHP warning
        // from evaluating the conditional second screen with a nested array.
        set_error_handler(static function (int $severity, string $message): never {
            throw new \ErrorException($message, 0, $severity);
        });
        try {
            foreach ([[['garden']], ['value' => 'garden'], 1, true] as $value) {
                $result = QuestionCapture::validate($tree, ['n3' => $value]);
                self::assertInstanceOf(Refusal::class, $result);
                self::assertSame(RefusalCode::ChoiceInvalid, $result->code);
            }
        } finally {
            restore_error_handler();
        }
    }

    public function testCaptureSnapshotsOnlyQuestionsOnTheChosenBranch(): void
    {
        $template = json_decode((string) file_get_contents(WCONVERT_DIR . '/pro/modules/journeys/templates/journey-service-enquiry.json'), true, 512, JSON_THROW_ON_ERROR);
        $tree = $template['tree'];
        $design = ['id' => 'design', 'name' => 'Design details', 'kind' => 'input', 'content' => ['type' => 'stack', 'children' => [
            ['type' => 'question', 'id' => 'q_design', 'label' => 'Project size?', 'answer_type' => 'single', 'required' => false,
                'options' => [['value' => 'small', 'label' => 'Small'], ['value' => 'large', 'label' => 'Large']]],
            ['type' => 'button', 'action' => 'next', 'label' => 'Continue'],
        ]]];
        array_splice($tree['steps'], 2, 0, [$design]);
        $condition = static fn (string $value): array => ['match' => 'all', 'clauses' => [
            ['question' => 'n2', 'operator' => 'is', 'values' => [$value]],
        ]];
        $tree['steps'][0]['paths'] = [['to' => 'repair', 'when' => $condition('repair')], ['to' => 'design', 'when' => $condition('design')], ['to' => 'contact']];
        $tree['steps'][1]['paths'] = [['to' => 'contact']];
        self::assertNull(CaptureJourney::issue($tree));
        $repair = QuestionCapture::validate($tree, ['n2' => 'repair', 'q_design' => 'small'], 'enquiry');
        self::assertIsArray($repair);
        self::assertSame(['n2'], array_column($repair, 'id'));
        $designed = QuestionCapture::validate($tree, ['n2' => 'design', 'q_design' => 'small'], 'enquiry');
        self::assertIsArray($designed);
        self::assertSame(['n2', 'q_design'], array_column($designed, 'id'));
        $tree['steps'][0]['paths'] = [['to' => 'received']];
        self::assertInstanceOf(Refusal::class, QuestionCapture::validate($tree, ['n2' => 'design'], 'enquiry'));
    }

    public function testGraphCaptureUsesVisitedOrderInsteadOfScreenStorageOrder(): void
    {
        $template = json_decode((string) file_get_contents(WCONVERT_DIR . '/pro/modules/journeys/templates/journey-service-enquiry.json'), true, 512, JSON_THROW_ON_ERROR);
        $tree = $template['tree'];
        $tree['v'] = 3;
        $tree['steps'] = [$tree['steps'][2], $tree['steps'][3], $tree['steps'][1], $tree['steps'][0]];
        $tree['graph'] = ['entry' => 'service', 'edges' => [
            ['id' => 'start', 'from' => 'service', 'to' => 'repair', 'kind' => 'default'],
            ['id' => 'repair_next', 'from' => 'repair', 'to' => 'contact', 'kind' => 'default'],
            ['id' => 'repair_hidden', 'from' => 'repair', 'to' => 'contact', 'kind' => 'hidden'],
            ['id' => 'saved', 'from' => 'contact', 'to' => 'received', 'kind' => 'default'],
        ]];
        $answer = QuestionCapture::validate($tree, ['n2' => 'repair'], 'enquiry');
        self::assertIsArray($answer);
        self::assertSame(['n2'], array_column($answer, 'id'));
        self::assertSame('service', $answer[0]['screen']);
        self::assertInstanceOf(Refusal::class, QuestionCapture::validate($tree, ['n2' => 'repair'], 'missing'));
    }
}
