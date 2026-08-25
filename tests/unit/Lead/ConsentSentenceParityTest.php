<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\ConsentRecord;
use WConvert\Template\TemplateVocabulary;

/**
 * The server's half of the consent-sentence parity.
 *
 * The [[Consent Record]] is the wording **exactly as it was shown**, and two
 * programs decide what that is: `resources/renderer/src/render.ts` draws it in
 * the browser, and {@see ConsentRecord} composes the evidence here. Neither can
 * defer to the other — the renderer is a pure function with no server, and the
 * server cannot trust a wording a public endpoint's client supplied
 * (ADR 0032).
 *
 * So they are two spellings of one rule, and the fixture is what stops them
 * drifting. `tests/js/renderer-consent-parity.test.ts` reads the same file and
 * asserts the same strings, exactly as the rule and template manifests are
 * held together from both sides (ADR 0005, ADR 0010).
 *
 * **If this fails, one of the two moved.** Consent evidence that does not say
 * what the visitor read is evidence of nothing, so the fix is to make them
 * agree — never to update the fixture to match whichever side changed.
 */
#[CoversClass(ConsentRecord::class)]
final class ConsentSentenceParityTest extends TestCase
{
    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function sentences(): array
    {
        $fixture = json_decode(
            (string) file_get_contents(__DIR__ . '/../../fixtures/consent-sentences.json'),
            true
        );

        self::assertIsArray($fixture);

        $cases = [];

        /** @var array{why: string, node: array<string, mixed>, shown: string} $case */
        foreach ($fixture['cases'] as $case) {
            $cases[$case['why']] = [$case['node'], $case['shown']];
        }

        return $cases;
    }

    /**
     * @param array<string, mixed> $node
     */
    #[DataProvider('sentences')]
    public function testTheRecordIsTheSentenceTheVisitorRead(array $node, string $shown): void
    {
        // The schemes come from the same manifest the renderer's own parity
        // test reads, so "which hrefs render an anchor" has one answer on both
        // sides rather than two that agree today.
        $schemes = TemplateVocabulary::fromManifest(__DIR__ . '/../../..')->schemes();

        $this->assertSame($shown, ConsentRecord::asShown($node, $schemes));
    }
}
