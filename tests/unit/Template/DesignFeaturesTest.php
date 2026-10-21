<?php
namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\DesignFeatures;
use WConvert\Template\GoogleFonts;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateVocabulary;
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

    public function testNestedConfigurationIsClosedAndBounded(): void
    {
        $this->assertSame([], DesignFeatures::fonts([['family' => 'https://evil.test/font.css', 'faces' => [['weight' => 400]]]]));
        $this->assertNull(DesignFeatures::decorations(['label' => 'Bats', 'items' => [['kind' => 'script', 'x' => 1, 'y' => 1, 'size' => 20]]]));
        $decorations = DesignFeatures::decorations(['label' => 'Bats', 'script' => 'alert(1)', 'items' => [['kind' => 'bat', 'x' => -10, 'y' => 120, 'size' => 900, 'motion' => 'custom-script', 'src' => 'bad']]]);
        $this->assertSame(['label' => 'Bats', 'hidden' => false, 'items' => [['kind' => 'bat', 'x' => 0, 'y' => 100, 'size' => 160]]], $decorations);
    }

    public function testFeaturesSurviveSaveSnapshotAndCopyBinding(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $font = ['family' => 'Creepster', 'faces' => [['weight' => 400, 'italic' => false]]];
        $decorations = ['label' => 'Flying bats', 'hidden' => true, 'items' => [['kind' => 'bat', 'x' => 10, 'y' => 20, 'size' => 48, 'motion' => 'flap']]];
        $design = $vocabulary->normalize(['tree' => ['fonts' => [$font], 'steps' => [[
            'id' => 'offer', 'name' => 'Offer', 'kind' => 'content', 'content' => ['type' => 'panel', 'decorations' => $decorations, 'children' => [
                ['type' => 'heading', 'id' => 'n1', 'role' => 'headline', 'text' => 'Halloween'],
                ['type' => 'countdown', 'id' => 'n2', 'layout' => 'boxes', 'density' => 'compact'],
            ]],
        ]]], 'tokens' => ['heading-font' => "'Creepster', cursive"]]);
        $bound = SlotRoles::bind($vocabulary->withoutCopy($design['tree']), ['headline' => 'Your offer'], $vocabulary);
        $this->assertSame([$font], $bound['fonts'] ?? null);
        $this->assertSame($decorations, $bound['steps'][0]['content']['decorations']);
        $this->assertSame('compact', $bound['steps'][0]['content']['children'][1]['density']);
        $this->assertSame('Your offer', $bound['steps'][0]['content']['children'][0]['text']);
        $this->assertFalse(GoogleFonts::enabled());
    }
}
