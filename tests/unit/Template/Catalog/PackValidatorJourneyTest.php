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

    public function testPaidPackKeepsQuestionReferencesAndRequiresDeclaredCapability(): void
    {
        Journeys::on();
        $pack = $this->pack();
        $decoded = $this->validator(Tier::Basic)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
        self::assertSame('n3', $decoded['templates'][0]['tree']['steps'][1]['when']['clauses'][0]['question']);
        self::assertSame('Where will you use it?', $decoded['templates'][0]['tree']['steps'][0]['content']['children'][2]['label']);
        unset($pack['requires']['capabilities'][2]);
        $this->expectException(RuntimeException::class);
        $this->validator(Tier::Basic)->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    public function testFreeInstallerRejectsPaidQuizPack(): void
    {
        $this->expectException(RuntimeException::class);
        $this->validator(Tier::Free)->decode(json_encode($this->pack(), JSON_THROW_ON_ERROR));
    }

    /**
     * A paid rung is not the question — the registration is (ADR 0116). A
     * Basic install whose journeys module did not register refuses the pack,
     * and says so without naming a product.
     */
    public function testAPaidInstallWithoutTheJourneysModuleRejectsAQuizPack(): void
    {
        $this->expectExceptionMessage('This design uses elements this site can’t display.');
        $this->validator(Tier::Basic)->decode(json_encode($this->pack(), JSON_THROW_ON_ERROR));
    }
}
