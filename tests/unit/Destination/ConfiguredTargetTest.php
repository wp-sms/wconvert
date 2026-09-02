<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConfiguredTarget;

/**
 * ============================================================================
 * AN EMPTY TARGET MEANS THREE DIFFERENT THINGS, AND TWO OF THEM ARE FINE.
 * ============================================================================
 * This began as one string feeding one success sentence, where *"nothing to
 * say"* and *"nothing chosen"* could safely collapse: the sentence simply got
 * shorter. It now feeds a LINE under every [[Destination]] on two screens, and
 * there the collapse tells a merchant their working lead-magnet Destination is
 * broken.
 *
 * So the three states are the subject of this test, and they are stated as the
 * differences between them rather than as three assertions about one method:
 *
 * | Answer | What it is | What a screen does |
 * |---|---|---|
 * | `null` | this type selects nothing | say nothing |
 * | `''` | it selects something, nothing chosen | *"not pointed at anything yet"* |
 * | a string | where it lands | *"sending to Newsletter"* |
 *
 * The fourth case — a schema that could not be READ — is
 * `DestinationController::targetOf()`'s, because it is the only thing that
 * knows a read reached the wire. It answers `null` for it, and
 * {@see \WConvert\Tests\Unit\Rest\DestinationRoutesTest} holds that.
 */
#[CoversClass(ConfiguredTarget::class)]
final class ConfiguredTargetTest extends TestCase
{
    /**
     * **The lead-magnet email, and every webhook that will ever ship.**
     *
     * A URL, a subject and a body are configuration rather than a target — so
     * this Destination is not *unpointed*, it is *pointless to ask*. A screen
     * that read `''` here and printed "not pointed at anything yet" would be
     * reporting a fault against an integration that delivers.
     */
    public function testATypeThatSelectsNothingAnswersNullRatherThanEmpty(): void
    {
        $schema = [
            'file_url' => ['type' => 'url', 'label' => 'Link to the file'],
            'subject' => ['type' => 'text', 'label' => 'Subject line'],
            'body' => ['type' => 'multiline', 'label' => 'Message'],
        ];

        self::assertNull(ConfiguredTarget::of($schema, [
            'file_url' => 'https://example.com/guide.pdf',
            'subject' => 'Your download',
            'body' => 'Here you go: {link}',
        ]));
    }

    /**
     * A schema with nothing in it at all — a type this install cannot see, so
     * there was no schema to read — is the same answer for the same reason.
     */
    public function testAnEmptySchemaAnswersNull(): void
    {
        self::assertNull(ConfiguredTarget::of([], ['lists' => ['3']]));
    }

    /**
     * **The one state that IS a fault.** A MailPoet Destination with no list
     * ticked will push nowhere useful, and saying so changes what the merchant
     * does next (ADR 0042).
     *
     * Set by the SCHEMA and never by the settings: the type offers a selector
     * whether or not the merchant has used it.
     */
    public function testASelectingFieldWithNothingChosenAnswersEmptyRatherThanNull(): void
    {
        $schema = [
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists to add to',
                'options' => [['value' => '3', 'label' => 'Newsletter']],
            ],
        ];

        self::assertSame('', ConfiguredTarget::of($schema, []));
        self::assertSame('', ConfiguredTarget::of($schema, ['lists' => []]));
    }

    /**
     * The ids the merchant chose, in the merchant's own words — read off the
     * schema the type already publishes, so no type implements anything for
     * this (#4).
     */
    public function testChosenIdsAreNamedFromTheSchemasOwnOptions(): void
    {
        $schema = [
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists to add to',
                'options' => [
                    ['value' => '3', 'label' => 'Newsletter'],
                    ['value' => '4', 'label' => 'Product updates'],
                ],
            ],
        ];

        self::assertSame(
            'Newsletter, Product updates',
            ConfiguredTarget::of($schema, ['lists' => ['3', '4']])
        );
    }

    /**
     * **WSMS's tags, which the provider cannot enumerate**, because they are
     * the merchant's own strings and the admin has no list to offer. The
     * stored ids ARE the words the merchant typed, so they stand as the
     * answer rather than being dropped for want of a label.
     */
    public function testAnUnenumerableFieldFallsBackToTheStoredIds(): void
    {
        $schema = ['tags' => ['type' => 'ids', 'label' => 'Tags to add']];

        self::assertSame('vip, newsletter', ConfiguredTarget::of($schema, [
            'tags' => ['vip', 'newsletter'],
        ]));
    }

    /**
     * A stored id the provider no longer offers — a list the merchant binned —
     * falls back to the raw id beside the ones that resolved, rather than
     * vanishing out of the sentence.
     */
    public function testAnIdTheProviderNoLongerOffersIsNamedAsItself(): void
    {
        $schema = [
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists to add to',
                'options' => [['value' => '3', 'label' => 'Newsletter']],
            ],
        ];

        self::assertSame('9, Newsletter', ConfiguredTarget::of($schema, ['lists' => ['9', '3']]));
    }

    /**
     * A type may select over more than one field. Every selecting field
     * contributes, and the ones that select nothing contribute nothing —
     * which is what keeps the lead-magnet email's subject line out of a
     * sentence about lists.
     */
    public function testEverySelectingFieldContributesAndTheOthersDoNot(): void
    {
        $schema = [
            'subject' => ['type' => 'text', 'label' => 'Subject line'],
            'lists' => [
                'type' => 'ids',
                'label' => 'Lists',
                'options' => [['value' => '3', 'label' => 'Newsletter']],
            ],
            'tags' => ['type' => 'ids', 'label' => 'Tags'],
        ];

        self::assertSame('Newsletter, vip', ConfiguredTarget::of($schema, [
            'subject' => 'Welcome',
            'lists' => ['3'],
            'tags' => ['vip'],
        ]));
    }
}
