<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\ResultProductSource;
use WConvert\Template\TemplateVocabulary;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Transfer\DesignPackage;

final class ResultProductSourceTest extends TestCase
{
    public function testDraftEditsSurviveNormalizationButCannotRunUntilComplete(): void
    {
        $draft = ['category_id' => 23, 'attributes' => [['taxonomy' => 'pa_color', 'term_id' => 0]]];
        self::assertSame($draft, ResultProductSource::normalize($draft));
        self::assertFalse(ResultProductSource::valid($draft));
        $draft['attributes'][0]['term_id'] = 45;
        self::assertTrue(ResultProductSource::valid($draft));
    }

    public function testMalformedOrOversizedFiltersNeverBecomeAnUnfilteredCategory(): void
    {
        $empty = ['category_id' => 0, 'attributes' => []];
        foreach ([null, [], ['category_id' => '23', 'attributes' => []],
            ['category_id' => 23, 'attributes' => [['taxonomy' => 'category', 'term_id' => 1]]],
            ['category_id' => 23, 'attributes' => array_fill(0, 4, ['taxonomy' => 'pa_color', 'term_id' => 1])],
            ['category_id' => 23, 'attributes' => [['taxonomy' => 'pa_color', 'term_id' => 1], ['taxonomy' => 'pa_color', 'term_id' => 2]]],
            ['category_id' => 23, 'attributes' => [], 'invented' => true]] as $invalid) {
            self::assertSame($empty, ResultProductSource::normalize($invalid));
            self::assertFalse(ResultProductSource::valid($invalid));
        }
    }

    public function testLiveCatalogChecksBelongToPublicationNotVisitorContactCapture(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_PRO_DIR . '/modules/journeys/templates/journey-product-finder.json'), true);
        foreach ($design['tree']['steps'] as &$step) if (($step['kind'] ?? '') === 'result') {
            $step['products_required'] = false;
            foreach ($step['results'] as &$result) {
                $result['product_filter'] = ['category_id' => 999999, 'attributes' => []];
                $result['href'] = '/shop'; $result['link_label'] = 'Browse shop';
            }
            unset($result);
        }
        unset($step);
        $config = ['template' => TemplateVocabulary::fromManifest()->normalize($design)];
        self::assertNull(\WConvert\Template\CaptureContract::issue($config, 'find_match', ''));
        self::assertSame('products', \WConvert\Template\CaptureContract::issue($config, 'find_match', '', true));
    }

    public function testSourceAndHandPickedChoicesSurviveASaveAndTransferRequiresRemapping(): void
    {
        $design = json_decode((string) file_get_contents(WCONVERT_PRO_DIR . '/modules/journeys/templates/journey-product-finder.json'), true);
        foreach ($design['tree']['steps'] as &$step) if (($step['kind'] ?? '') === 'result') {
            $step['results'][0]['product_filter'] = ['category_id' => 23, 'attributes' => [['taxonomy' => 'pa_color', 'term_id' => 45]]];
            $step['results'][0]['product_ids'] = [123];
        }
        unset($step);
        $normal = array_replace($design, TemplateVocabulary::fromManifest()->normalize($design));
        $result = array_values(array_filter($normal['tree']['steps'], static fn (array $step): bool => ($step['kind'] ?? '') === 'result'))[0]['results'][0];
        self::assertSame(23, $result['product_filter']['category_id']);
        self::assertSame([123], $result['product_ids']);
        add_filter('wconvert_journeys', static fn (): bool => true);
        $path = tempnam(sys_get_temp_dir(), 'wc-result-');
        try {
            $validator = new PackValidator(\WConvert\Template\TemplateManifest::load(), TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Basic);
            $package = new DesignPackage($validator);
            $package->write($path, $normal, static fn (string $url) => null);
            $read = $package->read($path);
            $imported = array_values(array_filter($read['design']['tree']['steps'], static fn (array $step): bool => ($step['kind'] ?? '') === 'result'))[0]['results'][0];
            self::assertSame(['category_id' => 0, 'attributes' => []], $imported['product_filter']);
            self::assertSame([], $imported['product_ids']);
            self::assertContains('Choose the category and attribute values on the receiving site.', $read['notes']);
            self::assertFalse(ResultProductSource::valid($imported['product_filter']));
        } finally { unlink($path); unset($GLOBALS['wconvertTestFilters']['wconvert_journeys']); }
    }
}
