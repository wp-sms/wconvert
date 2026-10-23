<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;

final class PackValidatorLayoutTest extends TestCase
{
    /** @return array<string, mixed> */
    private function pack(string $type, string $param, mixed $value): array
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true, 512, JSON_THROW_ON_ERROR);
        $content = $design['tree']['steps'][0]['content'];
        $design['tree']['steps'][0]['content'] = ['type' => $type, $param => $value]
            + ($type === 'split' ? ['start' => [$content], 'end' => []] : ['children' => [$content]]);
        return ['schema' => 1, 'id' => 'layout-review', 'version' => '1.0.0', 'name' => 'Layout review', 'description' => '',
            'requires' => ['plugin' => '1.0.0', 'tree' => 2, 'capabilities' => PackValidator::CAPABILITIES],
            'assets' => [], 'templates' => [$design]];
    }

    public function testCatalogueAndMerchantTransferPreserveOffPresetLayoutValues(): void
    {
        $reader = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest());
        $cases = array_map(static fn ($ratio): array => ['split', 'ratio', $ratio], [0, .08, .1, .3, .36, 1, '0.35', '0.5']);
        array_push($cases, ['split', 'basis', '6rem'], ['split', 'basis', '24rem'], ['grid', 'basis', '10rem'],
            ['media', 'min', '380px'], ['panel', 'min', '18.5em'], ['panel', 'min', 0], ['media', 'min', '0']);
        foreach ($cases as [$type, $param, $value]) {
            $pack = $this->pack($type, $param, $value);
            $installed = $reader->decode(json_encode($pack, JSON_THROW_ON_ERROR));
            self::assertSame($value, $installed['templates'][0]['tree']['steps'][0]['content'][$param]);
            $transferred = $reader->portable($pack['templates'][0]);
            self::assertSame($value, $transferred['tree']['steps'][0]['content'][$param]);
        }
    }

    public function testLayoutExceptionsDoNotAdmitUnsafeSizesOrUnknownEnums(): void
    {
        $reader = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest());
        $cases = [
            ['split', 'ratio', -.1], ['split', 'ratio', 1.1], ['split', 'ratio', true], ['split', 'ratio', 'NaN'],
            ['split', 'ratio', '0.5;display:none'], ['split', 'basis', '-6rem'], ['grid', 'basis', '10001px'],
            ['media', 'min', '380'], ['panel', 'min', 'url(https://example.com/pixel)'],
            ['media', 'min', '380px;position:fixed'], ['panel', 'min', ['380px']], ['panel', 'edges', 'unknown'],
        ];
        foreach ($cases as [$type, $param, $value]) foreach ([false, true] as $portable) {
            $pack = $this->pack($type, $param, $value);
            try {
                if ($portable) $reader->portable($pack['templates'][0]);
                else $reader->decode(json_encode($pack, JSON_THROW_ON_ERROR));
                self::fail('Accepted invalid layout value: ' . json_encode([$type, $param, $value, $portable]));
            } catch (RuntimeException $error) {
                self::assertNotSame('', $error->getMessage());
            }
        }
    }

    public function testCatalogueAndMerchantTransferKeepPaletteReferencesInGradients(): void
    {
        $reader = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest());
        $gradient = 'repeating-linear-gradient(90deg,var(--wc-fg) 0 18px,transparent 18px 36px)';
        $pack = $this->pack('panel', 'min', '380px');
        $pack['templates'][0]['tokens']['bg-image'] = $gradient;
        $pack['templates'][0]['tree']['steps'][0]['content']['tokens'] = ['bg-image' => $gradient];
        $pack['templates'][0]['tree']['steps'][0]['content']['narrow'] = ['bg-image' => 'linear-gradient(var(--wc-bg), var(--wc-accent))'];
        $installed = $reader->decode(json_encode($pack, JSON_THROW_ON_ERROR));
        $transferred = $reader->portable($pack['templates'][0]);
        foreach ([$installed['templates'][0], $transferred] as $design) {
            self::assertSame($gradient, $design['tokens']['bg-image']);
            self::assertSame($gradient, $design['tree']['steps'][0]['content']['tokens']['bg-image']);
            self::assertSame($pack['templates'][0]['tree']['steps'][0]['content']['narrow'], $design['tree']['steps'][0]['content']['narrow']);
        }
    }

    public function testPaletteReferencesCannotReadExternalVariablesOrUseFallbacks(): void
    {
        $reader = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest());
        foreach (['var(--theme-colour)', 'var(--wc-unknown)', 'var(--wc-n-fg)', 'var(--wc-fg, red)',
            'var(--wc-fg, var(--wc-bg))', 'var(var(--wc-fg))', 'var(--wc-fg) url(pixel)',
            'var(--wc-fg) expression(alert(1))', 'x-var(--wc-fg)'] as $value) {
            foreach ([false, true] as $portable) {
                $pack = $this->pack('panel', 'min', '380px');
                $pack['templates'][0]['tokens']['bg-image'] = $value;
                try {
                    if ($portable) $reader->portable($pack['templates'][0]);
                    else $reader->decode(json_encode($pack, JSON_THROW_ON_ERROR));
                    self::fail('Accepted unsafe variable expression: ' . $value);
                } catch (RuntimeException $error) {
                    self::assertNotSame('', $error->getMessage());
                }
            }
        }
    }
}
