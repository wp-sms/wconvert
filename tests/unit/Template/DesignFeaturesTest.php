<?php
namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\DesignFeatures;
use WConvert\Template\GoogleFonts;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateVocabulary;
use WConvert\Frontend\PayloadTag;
use WConvert\Rest\ThemeController;
use WP_REST_Request;
use WP_Error;

final class DesignFeaturesTest extends TestCase
{
    protected function tearDown(): void { unset($GLOBALS['wconvertTestOptionTable'][GoogleFonts::OPTION]); }

    public function testRemoteFontsAreOffUntilExplicitlyAcknowledged(): void
    {
        unset($GLOBALS['wconvertTestOptionTable'][GoogleFonts::OPTION]);
        $controller = new ThemeController();
        $this->assertFalse(GoogleFonts::enabled());
        $request = new WP_REST_Request('POST');
        $request->set_param('enabled', true);
        $this->assertInstanceOf(WP_Error::class, $controller->saveFonts($request));
        $this->assertFalse(GoogleFonts::enabled());
        $request->set_param('acknowledged', true);
        $controller->saveFonts($request);
        $this->assertTrue(GoogleFonts::enabled());
        $request->set_param('enabled', false);
        $request->set_param('acknowledged', false);
        $controller->saveFonts($request);
        $this->assertFalse(GoogleFonts::enabled());
    }

    /** The page, not the editor, is what talks to Google: off means no font list and no permission flag reach it. */
    public function testThePageCarriesGoogleFontsOnlyWhileTheSiteAllowsThem(): void
    {
        $font = ['family' => 'Creepster', 'faces' => [['weight' => 400, 'italic' => false]]];
        $entries = [['id' => '01A', 'template' => ['tokens' => [], 'tree' => ['fonts' => [$font], 'steps' => []]]]];
        $fontsIn = static function (string $tag): mixed {
            preg_match('/<script[^>]*>(.*)<\/script>/s', $tag, $json);
            return json_decode($json[1] ?? 'null', true)[0]['template']['tree']['fonts'] ?? null;
        };

        $off = PayloadTag::render($entries, 'https://example.test/capture', 'https://example.test/beacon', null, 'UTC');
        $this->assertStringNotContainsString('data-google-fonts', $off);
        $this->assertSame([], $fontsIn($off));

        GoogleFonts::set(true);
        $on = PayloadTag::render($entries, 'https://example.test/capture', 'https://example.test/beacon', null, 'UTC');
        $this->assertStringContainsString('data-google-fonts="1"', $on);
        $this->assertSame([$font], $fontsIn($on));
    }

    public function testNestedConfigurationIsClosedAndBounded(): void
    {
        $this->assertSame([], DesignFeatures::fonts([['family' => 'https://evil.test/font.css', 'faces' => [['weight' => 400]]]]));
        $this->assertNull(DesignFeatures::decorations(['label' => 'Bats', 'items' => [['kind' => 'script', 'x' => 1, 'y' => 1, 'size' => 20]]]));
        $decorations = DesignFeatures::decorations(['label' => 'Bats', 'script' => 'alert(1)', 'items' => [['kind' => 'bat', 'x' => -10, 'y' => 120, 'size' => 900, 'motion' => 'custom-script', 'src' => 'bad']]]);
        $this->assertSame(['label' => 'Bats', 'hidden' => false, 'items' => [['kind' => 'bat', 'x' => 0, 'y' => 100, 'size' => 160]]], $decorations);
    }

    public function testResponsiveCompositionOptionsSurviveNormalizationAndRejectInvalidShapes(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $tree = ['steps' => [['id' => 'offer', 'name' => 'Offer', 'kind' => 'content', 'content' => [
            'type' => 'split', 'basis' => '0px', 'narrow_layout' => 'reverse',
            'start' => [['type' => 'grid', 'narrow_basis' => '4rem', 'children' => []]],
            'end' => [['type' => 'grid', 'narrow_basis' => 'url(evil)', 'children' => []]],
        ]]]];
        $normal = $vocabulary->normalize(['tree' => $tree, 'tokens' => []])['tree']['steps'][0]['content'];
        $this->assertSame('reverse', $normal['narrow_layout']);
        $this->assertSame('4rem', $normal['start'][0]['narrow_basis']);
        $this->assertArrayNotHasKey('narrow_basis', $normal['end'][0]);
        $tree['steps'][0]['content']['narrow_layout'] = 'arbitrary-css';
        $normal = $vocabulary->normalize(['tree' => $tree, 'tokens' => []])['tree']['steps'][0]['content'];
        $this->assertArrayNotHasKey('narrow_layout', $normal);
    }

    public function testReceiptFeaturesAreBoundedAndSurviveCopyBinding(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $design = ['tokens' => [], 'tree' => ['steps' => [['id' => 'offer', 'name' => 'Offer', 'kind' => 'content', 'content' => [
            'type' => 'panel', 'children' => [
                ['type' => 'divider', 'id' => 'n1', 'pattern' => 'dashed'],
                ['type' => 'divider', 'id' => 'n2', 'pattern' => 'url(evil)'],
                ['type' => 'panel', 'edge' => 'polygon(anything)', 'children' => []],
                ['type' => 'code', 'id' => 'n3', 'appearance' => 'plain', 'text' => 'CODE'],
                ['type' => 'code', 'id' => 'n4', 'appearance' => 'custom-css', 'text' => 'CODE'],
                ['type' => 'text', 'id' => 'n5', 'text' => '50%', 'tokens' => ['text-weight' => '950']],
            ],
        ]]]]];
        $normal = $vocabulary->normalize($design)['tree']['steps'][0]['content'];
        $this->assertSame('dashed', $normal['children'][0]['pattern']);
        $this->assertArrayNotHasKey('pattern', $normal['children'][1]);
        $this->assertArrayNotHasKey('edge', $normal['children'][2]);
        $this->assertSame('plain', $normal['children'][3]['appearance']);
        $this->assertArrayNotHasKey('appearance', $normal['children'][4]);
        $this->assertSame('950', $normal['children'][5]['tokens']['text-weight']);
    }

    public function testFeaturesSurviveSaveSnapshotAndCopyBinding(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $font = ['family' => 'Creepster', 'faces' => [['weight' => 400, 'italic' => false]]];
        $decorations = ['label' => 'Flying bats', 'hidden' => true, 'items' => [['kind' => 'bat', 'x' => 10, 'y' => 20, 'size' => 48, 'motion' => 'flap']]];
        $design = $vocabulary->normalize(['tree' => ['fonts' => [$font], 'steps' => [[
            'id' => 'offer', 'name' => 'Offer', 'kind' => 'content', 'content' => ['type' => 'panel', 'decorations' => $decorations, 'children' => [
                ['type' => 'heading', 'id' => 'n1', 'role' => 'headline', 'text' => 'Halloween'],
                ['type' => 'countdown', 'id' => 'n2', 'layout' => 'boxes', 'density' => 'compact', 'precision' => 'minutes'],
            ]],
        ]]], 'tokens' => ['heading-font' => "'Creepster', cursive"]]);
        $bound = SlotRoles::bind($vocabulary->withoutCopy($design['tree']), ['headline' => 'Your offer'], $vocabulary);
        $this->assertSame([$font], $bound['fonts'] ?? null);
        $this->assertSame($decorations, $bound['steps'][0]['content']['decorations']);
        $this->assertSame('compact', $bound['steps'][0]['content']['children'][1]['density']);
        $this->assertSame('minutes', $bound['steps'][0]['content']['children'][1]['precision']);
        $this->assertSame('Your offer', $bound['steps'][0]['content']['children'][0]['text']);
        $this->assertFalse(GoogleFonts::enabled());
    }
}
