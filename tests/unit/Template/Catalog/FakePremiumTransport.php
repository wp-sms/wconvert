<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use RuntimeException;
use WConvert\Template\Catalog\CatalogPremiumTransport;

/** Pro's transport, as the catalogue sees it: one pass per batch. */
final class FakePremiumTransport extends FakeCatalogTransport implements CatalogPremiumTransport
{
    /** @var list<array{designs: list<string>, setups: list<string>}> */
    public array $passes = [];

    public function authorize(array $designs, array $setups): void
    {
        $this->passes[] = ['designs' => $designs, 'setups' => $setups];
    }

    public function premium(string $path, int $limit): string
    {
        if ($this->passes === []) throw new RuntimeException('No pass');
        return $this->get(CatalogFixture::BASE . $path, $limit);
    }
}
