<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use WConvert\Support\Tier;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\Journeys;

final class PackValidatorJourneyTest extends TestCase
{
    protected function tearDown(): void
    {
        Journeys::off();
    }

    /** @return array<string, mixed> */
    private function pack(): array
    {
        $template = json_decode((string) file_get_contents(WCONVERT_DIR . '/pro/modules/journeys/templates/journey-product-finder.json'), true, 512, JSON_THROW_ON_ERROR);
        return ['schema' => 1, 'id' => 'finder', 'version' => '1.0.0', 'name' => 'Finder', 'description' => 'A product finder.',
            'requires' => ['plugin' => '0.1.0', 'tree' => 2, 'capabilities' => ['template-tree:2', 'capture-journey:1', 'question-journey:1']],
            'assets' => [], 'templates' => [$template]];
    }

    private function validator(Tier $tier): PackValidator
    {
        return new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), $tier);
    }

    /** A downloaded flow keeps its routes through installation and later updates. */
    public function testGraphPackInstallsUpdatesAndRemainsReadableOffline(): void
    {
        Journeys::on();
        $pack = $this->pack();
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-enquiry.json'), true);
        $pack['templates'][0]['tree'] = $tree;
        $pack['requires']['tree'] = 3;
        $pack['requires']['capabilities'][] = 'template-tree:3';
        $directory = sys_get_temp_dir() . '/wc-graph-pack-' . bin2hex(random_bytes(6));
        $validator = $this->validator(Tier::Pro);
        $store = static function (array $pack, int $revision) use ($directory, $validator): void {
            $object = ['schema' => 3, 'minor' => 0, 'id' => 'graph', 'revision' => $revision, 'name' => $pack['templates'][0]['name'],
                'display_type' => $pack['templates'][0]['display_type'], 'tier' => 'pro', 'requires' => $pack['requires'],
                'assets' => [], 'tree' => $pack['templates'][0]['tree'], 'tokens' => $pack['templates'][0]['tokens']];
            $json = json_encode($object, JSON_THROW_ON_ERROR);
            $validator->validate(\WConvert\Template\Catalog\DesignObject::design($json, hash('sha256', $json))['pack']);
            (new \WConvert\Template\Catalog\DesignArchive($directory, $validator, 'secret', null, 'pro'))->store('designs', hash('sha256', $json), $json);
        };
        try {
            $pack['templates'][0]['tier'] = 'pro';
            $store($pack, 1);
            $pack['templates'][0]['tokens']['bg'] = '#ffffff';
            $store($pack, 2);
            $offline = new \WConvert\Template\Catalog\DesignArchive($directory, $validator, 'secret', null, 'pro');
            $library = \WConvert\Template\TemplateLibrary::from(TemplateVocabulary::fromManifest(), $offline);
            self::assertCount(2, $library->all());
            $original = $library->find('design-1-graph');
            self::assertSame($tree['graph'], $original['tree']['graph']);
            self::assertNotSame('#ffffff', $original['tokens']['bg'] ?? null);
            self::assertFalse($original['catalog_current']);
            self::assertTrue($library->find('design-2-graph')['catalog_current']);
        } finally {
            $files = is_dir($directory) ? new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) : [];
            foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testGraphPacksRejectMissingCapabilitiesUnsafeRoutesAndSiteData(): void
    {
        Journeys::on();
        $base = $this->pack();
        $base['templates'][0]['tree'] = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-enquiry.json'), true);
        $base['requires']['tree'] = 3;
        $base['requires']['capabilities'][] = 'template-tree:3';
        foreach ([
            static function (&$p) { array_pop($p['requires']['capabilities']); },
            static function (&$p) { $p['requires']['tree'] = 2; },
            static function (&$p) { $p['templates'][0]['tree']['graph']['edges'][0]['to'] = 'missing'; },
            static function (&$p) { $p['templates'][0]['tree']['graph']['edges'][0]['execute'] = 'anything'; },
            static function (&$p) { $p['templates'][0]['tree']['steps'][0]['content']['children'][1]['href'] = 'https://another-shop.example'; },
        ] as $change) {
            $pack = $base;
            $change($pack);
            try {
                $this->validator(Tier::Pro)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
                self::fail('Unsafe or undeclared graph pack was accepted');
            } catch (RuntimeException $error) {
                self::assertNotSame('', $error->getMessage());
            }
        }
    }

    public function testPaidPackKeepsQuestionReferencesAndRequiresDeclaredCapability(): void
    {
        Journeys::on();
        $pack = $this->pack();
        $decoded = $this->validator(Tier::Pro)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
        self::assertSame('n3', $decoded['templates'][0]['tree']['steps'][1]['when']['clauses'][0]['question']);
        self::assertSame('Where will you use it?', $decoded['templates'][0]['tree']['steps'][0]['content']['children'][2]['label']);
        unset($pack['requires']['capabilities'][2]);
        $this->expectException(RuntimeException::class);
        $this->validator(Tier::Pro)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    public function testCategoryOrderingRequiresTheNewCapability(): void
    {
        Journeys::on();
        $pack = $this->pack();
        foreach ($pack['templates'][0]['tree']['steps'] as &$step) if ($step['kind'] === 'result') {
            $step['results'][0]['product_filter'] = ['category_id' => 0, 'attributes' => [], 'order' => 'price_high'];
        }
        unset($step);
        $pack['requires']['capabilities'][] = 'result-product-filters:2';
        $decoded = $this->validator(Tier::Pro)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
        $results = array_values(array_filter($decoded['templates'][0]['tree']['steps'], static fn (array $step): bool => $step['kind'] === 'result'));
        self::assertSame('price_high', $results[0]['results'][0]['product_filter']['order']);
        $pack['requires']['capabilities'][3] = 'result-product-filters:1';
        $this->expectExceptionMessage('This pack does not declare every capability its designs need.');
        $this->validator(Tier::Pro)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    public function testPortablePacksCannotCarryProductExclusionsAcrossStores(): void
    {
        Journeys::on();
        $pack = $this->pack();
        $pack['requires']['capabilities'][] = 'result-product-filters:2';
        foreach ($pack['templates'][0]['tree']['steps'] as &$step) if ($step['kind'] === 'result') {
            $step['results'][0]['product_filter'] = ['category_id' => 0, 'attributes' => [], 'order' => 'newest', 'excluded_ids' => [123]];
        }
        unset($step);
        $this->expectExceptionMessage('Choose category, attributes and product choices on this site.');
        $this->validator(Tier::Pro)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    /** A product design imported on a free install names no product (ADR 0116 §3, 0127). */
    public function testAFreeInstallRefusesAProductDesignWithoutNamingAProduct(): void
    {
        $template = json_decode((string) file_get_contents(WCONVERT_DIR . '/pro/modules/cart-recovery/templates/cart-accessories.json'), true, 512, JSON_THROW_ON_ERROR);
        $template['tier'] = 'free';
        $pack = ['schema' => 1, 'id' => 'extras', 'version' => '1.0.0', 'name' => 'Extras', 'description' => 'Product extras.',
            'requires' => ['plugin' => '0.1.0', 'tree' => 2, 'capabilities' => ['template-tree:2', 'capture-journey:1']], 'assets' => [], 'templates' => [$template]];
        try {
            (new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), Tier::Free, true))->decode(json_encode($pack, JSON_THROW_ON_ERROR));
            self::fail('A product design must not install on a free site.');
        } catch (RuntimeException $refused) {
            self::assertSame('This design uses elements this site can’t display.', $refused->getMessage());
        }
    }

    public function testFreeInstallerRejectsPaidQuizPack(): void
    {
        $this->expectException(RuntimeException::class);
        $this->validator(Tier::Free)->decode(json_encode($this->pack(), JSON_THROW_ON_ERROR));
    }

    /**
     * The paid tier is not the question — the registration is (ADR 0116). A
     * Pro install whose journeys module did not register refuses the pack,
     * and says so without naming a product.
     */
    public function testAPaidInstallWithoutTheJourneysModuleRejectsAQuizPack(): void
    {
        $this->expectExceptionMessage('This design uses elements this site can’t display.');
        $this->validator(Tier::Pro)->decode(json_encode($this->pack(), JSON_THROW_ON_ERROR));
    }
}
