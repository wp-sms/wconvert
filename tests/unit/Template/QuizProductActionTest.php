<?php
namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\{CaptureContract, CommerceSupport, TemplateVocabulary};
use WConvert\Pro\Module\CartRecovery\QuizProducts;

final class QuizProductActionTest extends TestCase
{
    protected function tearDown(): void { unset($GLOBALS['wconvertTestFilters']['wconvert_commerce']); }

    /** @return array<string, mixed> */
    private function design(string $action): array
    {
        $source = file_get_contents(WCONVERT_PRO_DIR . '/modules/journeys/templates/journey-product-finder.json');
        if ($source === false) throw new \RuntimeException('Missing quiz fixture');
        $design = json_decode($source, true);
        foreach ($design['tree']['steps'] as &$step) if ($step['kind'] === 'result') {
            $step['products_required'] = false;
            foreach ($step['results'] as &$result) {
                $result['product_ids'] = [10]; $result['product_action'] = $action;
                $result['href'] = '/shop'; $result['link_label'] = 'Browse shop';
            }
            unset($result);
        }
        unset($step);
        return TemplateVocabulary::fromManifest()->normalize($design);
    }

    public function testUnknownActionsFailClosedAndLinkResultsKeepTheirExistingEntitlement(): void
    {
        self::assertSame('quiz_cart', CaptureContract::issue(['template' => $this->design('invented')], 'find_match', ''));
        self::assertSame('quiz_cart', CaptureContract::issue(['template' => $this->design('add_to_cart')], 'find_match', ''));
        self::assertNull(CaptureContract::issue(['template' => $this->design('link')], 'find_match', ''));
        add_filter('wconvert_commerce', static fn () => true);
        self::assertNull(CaptureContract::issue(['template' => $this->design('add_to_cart')], 'find_match', ''));
        self::assertTrue(CommerceSupport::quizAdditions($this->design('add_to_cart')['tree']));
        self::assertFalse(CommerceSupport::used($this->design('add_to_cart')['tree']));
    }

    public function testTransferRetainsActionIntentButRequiresNewProductChoices(): void
    {
        add_filter('wconvert_commerce', static fn () => true);
        add_filter('wconvert_journeys', static fn () => true);
        $path = tempnam(sys_get_temp_dir(), 'wc-quiz-');
        if ($path === false) throw new \RuntimeException('Cannot create test package');
        try {
            $validator = new \WConvert\Template\Catalog\PackValidator(\WConvert\Template\TemplateManifest::load(), TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Elite);
            $package = new \WConvert\Template\Transfer\DesignPackage($validator);
            $package->write($path, $this->design('add_to_cart') + ['name' => 'Quiz', 'display_type' => 'inline'], static fn (string $url) => null);
            $read = $package->read($path);
            self::assertTrue(CommerceSupport::quizAdditions($read['design']['tree']));
            foreach ($read['design']['tree']['steps'] as $screen) foreach ($screen['results'] ?? [] as $result) self::assertSame([], $result['product_ids']);
            self::assertSame('quiz_cart', CaptureContract::issue(['template' => $read['design']], 'find_match', ''));
        } finally { unlink($path); unset($GLOBALS['wconvertTestFilters']['wconvert_journeys']); }
    }

    public function testResultSelectionRequiresBothScreenAndResultAndRejectsAmbiguity(): void
    {
        $result = ['id' => 'pick', 'product_ids' => [10]];
        $screen = ['id' => 'results', 'kind' => 'result', 'results' => [$result]];
        $payload = ['template' => ['tree' => ['steps' => [$screen]]]];
        self::assertSame($result, QuizProducts::result($payload, 'results', 'pick'));
        self::assertNull(QuizProducts::result($payload, 'other', 'pick'));
        self::assertNull(QuizProducts::result($payload, 'results', 'other'));
        $payload['template']['tree']['steps'][] = $screen;
        self::assertNull(QuizProducts::result($payload, 'results', 'pick'));
    }
}
