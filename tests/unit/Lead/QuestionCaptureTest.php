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
}
