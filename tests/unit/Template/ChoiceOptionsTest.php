<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateVocabulary;

final class ChoiceOptionsTest extends TestCase
{
    public function testOnlyBoundedUniqueStableValuesAndLabelsSurvive(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $options = $vocabulary->choiceOptions([
            ['value' => 'installation', 'label' => ' Installation ', 'html' => '<b>ignored</b>'],
            ['value' => 'installation', 'label' => 'Duplicate'],
            ['value' => 'Repair', 'label' => 'Invalid value'],
            ['value' => 'blank', 'label' => ' '],
            ['value' => 'long', 'label' => str_repeat('a', 121)],
            ['value' => 'repair', 'label' => 'Réparation'],
            ['value' => "newline\n", 'label' => 'Invalid value'],
            ['value' => 'utf8', 'label' => "Invalid\xFF"],
            ['value' => ['bad'], 'label' => 'Bad shape'],
        ]);
        self::assertSame([
            ['value' => 'installation', 'label' => 'Installation'],
            ['value' => 'repair', 'label' => 'Réparation'],
        ], $options);
        self::assertCount(12, $vocabulary->choiceOptions(array_map(
            static fn(int $at): array => ['value' => 'option-' . $at, 'label' => 'Choice ' . $at], range(1, 20)
        )));
        self::assertSame([], $vocabulary->choiceOptions(['repair' => ['value' => 'repair', 'label' => 'Repair']]));
        self::assertCount(1, $vocabulary->choiceOptions([['value' => 'unicode', 'label' => str_repeat('🛠', 120)]]));
    }

    public function testOptionsAreOnlyKeptOnTheInterestField(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $options = [['value' => 'repair', 'label' => 'Repair']];
        $template = $vocabulary->normalize(['tree' => ['steps' => [[
            'type' => 'stack', 'children' => [
                ['type' => 'field', 'name' => 'email', 'options' => $options],
                ['type' => 'field', 'name' => 'interest', 'options' => $options],
            ],
        ]]]]);
        $fields = $template['tree']['steps'][0]['children'];
        self::assertArrayNotHasKey('options', $fields[0]);
        self::assertSame($options, $fields[1]['options']);
    }
}
