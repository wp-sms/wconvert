<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/** The real coupon's numeric display is not an interchangeable sentence headline. */
final class OfferAmountTransferTest extends TestCase
{
    public function testClosingTimeSentenceCannotFillExtraTenAmount(): void
    {
        $root = dirname(__DIR__, 3);
        $vocabulary = TemplateVocabulary::fromManifest($root);
        $entries = array_map(static fn (string $id): array => json_decode((string) file_get_contents($root . '/pro/modules/display-types/templates/' . $id . '.json'), true, 512, JSON_THROW_ON_ERROR), ['bf-closing-time', 'campaign-extra-ten-coupon']);
        $library = TemplateLibrary::from($vocabulary, new class($entries) implements \WConvert\Template\TemplateSource {
            /** @param list<array<string, mixed>> $values */
            public function __construct(private array $values) {}
            public function entries(): array { return $this->values; }
        });
        $closing = $library->find('bf-closing-time');
        $coupon = $library->find('campaign-extra-ten-coupon');
        self::assertNotNull($closing);
        self::assertNotNull($coupon);
        self::assertContains('offer_amount', SlotRoles::declaredIn($coupon['tree'], $vocabulary));
        $switched = $library->snapshotInto(['template_id' => 'campaign-extra-ten-coupon', 'template' => ['tree' => $closing['tree'], 'tokens' => $closing['tokens']]], 'bf-closing-time');
        $copy = SlotRoles::copyFrom($switched['template']['tree'], $vocabulary);
        self::assertArrayNotHasKey('headline', $copy);
        self::assertEmpty($copy['offer_amount'] ?? '', 'Missing offer figures must be filled explicitly, never guessed from an ordinary headline.');
    }
}
