<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\CanonicalFields;
use WConvert\Lead\CaptureForm;
use WConvert\Lead\Refusal;
use WConvert\Lead\RefusalCode;
use WConvert\Lead\Submission;
use WConvert\Template\TemplateVocabulary;

/**
 * The published qualification choice: its value is stable, while its label is
 * the wording the visitor saw and the Lead records alongside that value.
 */
#[CoversClass(CaptureForm::class)]
#[CoversClass(CanonicalFields::class)]
#[CoversClass(RefusalCode::class)]
#[CoversClass(Submission::class)]
final class InterestCaptureTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** @return list<array{value: string, label: string}> */
    private static function options(): array
    {
        return [
            ['value' => 'installation', 'label' => 'Installation'],
            ['value' => 'repair', 'label' => 'Repair'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function template(bool $required = true): array
    {
        return [
            'tree' => [
                'steps' => [
                    [
                        'type' => 'stack',
                        'children' => [
                            ['type' => 'field', 'name' => 'email', 'required' => true],
                            ['type' => 'field', 'name' => 'name'],
                            [
                                'type' => 'field',
                                'name' => 'interest',
                                'label' => 'Which service do you need?',
                                'placeholder' => 'Choose a service',
                                'required' => $required,
                                'options' => self::options(),
                            ],
                            ['type' => 'button', 'label' => 'Send', 'action' => 'submit'],
                        ],
                    ],
                    ['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Thanks']]],
                ],
            ],
            'tokens' => [],
        ];
    }

    /**
     * @param array<string, mixed> $template
     * @param array<string, mixed> $submitted
     */
    private static function validate(array $template, array $submitted): Submission|Refusal
    {
        return CaptureForm::fromTemplate(
            $template,
            TemplateVocabulary::fromManifest(self::PLUGIN_DIR)
        )->validate($submitted);
    }

    public function testStoresTheStableValueAndThePublishedLabel(): void
    {
        $submission = self::validate(self::template(), [
            'fields' => [
                'email' => 'sarah@example.com',
                'name' => 'Sarah Example',
                'interest' => 'installation',
                // A visitor cannot author the evidence label. It must come
                // from the published options above.
                'interest_label' => 'Spoofed label',
            ],
        ]);

        self::assertInstanceOf(Submission::class, $submission);
        self::assertSame('sarah@example.com', $submission->email);
        self::assertSame([
            'name' => 'Sarah Example',
            'interest' => 'installation',
            'interest_label' => 'Installation',
        ], $submission->fields);
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function invalidChoices(): array
    {
        return [
            'unknown value' => ['maintenance'],
            'display label instead of value' => ['Installation'],
            'array value' => [['installation']],
        ];
    }

    /** @param mixed $choice */
    #[DataProvider('invalidChoices')]
    public function testRejectsInvalidArrayAndUnknownChoices($choice): void
    {
        $result = self::validate(self::template(), [
            'fields' => [
                'email' => 'sarah@example.com',
                'name' => 'Sarah Example',
                'interest' => $choice,
            ],
        ]);

        self::assertInstanceOf(Refusal::class, $result);
        self::assertSame(RefusalCode::ChoiceInvalid, $result->code);
        self::assertSame('interest', $result->field);
    }

    public function testRequiredChoiceIsRejectedWhenMissing(): void
    {
        $result = self::validate(self::template(), [
            'fields' => ['email' => 'sarah@example.com', 'name' => 'Sarah Example'],
        ]);

        self::assertInstanceOf(Refusal::class, $result);
        self::assertSame(RefusalCode::FieldRequired, $result->code);
        self::assertSame('interest', $result->field);
    }

    public function testOptionalChoiceMayBeOmitted(): void
    {
        $result = self::validate(self::template(false), [
            'fields' => ['email' => 'sarah@example.com', 'name' => 'Sarah Example'],
        ]);

        self::assertInstanceOf(Submission::class, $result);
        self::assertSame('sarah@example.com', $result->email);
        self::assertSame(['name' => 'Sarah Example'], $result->fields);
    }

    public function testCanonicalFieldsForwardsInterestButNeverItsDisplayLabel(): void
    {
        $lead = new \WConvert\Lead\Lead(
            '01LEAD',
            '01OPTIN',
            'sarah@example.com',
            null,
            [
                'name' => 'Sarah Example',
                'interest' => 'installation',
                'interest_label' => 'Installation',
            ],
            '2026-09-11 10:00:00'
        );

        self::assertSame([
            'email' => 'sarah@example.com',
            'name' => 'Sarah Example',
            'interest' => 'installation',
        ], CanonicalFields::of($lead));
    }
}
