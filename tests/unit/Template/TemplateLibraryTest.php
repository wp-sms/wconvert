<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * The shipped gallery.
 *
 * The assertion that matters here is not "the file parses" — it is that a
 * shipped Template is expressible **entirely in the vocabulary**. Authoring is
 * the settings panel plus a dev-only export rather than hand-written JSON,
 * which is what makes the vocabulary self-testing: every shipped design is
 * provably reachable through the panel, so we never ship one the merchant
 * cannot adjust (ADR 0010).
 */
#[CoversClass(TemplateLibrary::class)]
final class TemplateLibraryTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function library(): TemplateLibrary
    {
        return TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR);
    }

    public function testTheV1SubmitMeteredTemplateShips(): void
    {
        $template = self::library()->find('centred-card');

        $this->assertIsArray($template);
        $this->assertSame('popup', $template['display_type']);
    }

    /**
     * A submit-metered template has TWO steps, the post-submit success state
     * being a terminal step. A click-metered one has one, because the click
     * navigates the visitor away (ADR 0010, corrected by ADR 0025).
     */
    public function testTheSubmitMeteredTemplateCarriesItsTerminalStep(): void
    {
        $template = self::library()->find('centred-card');

        $this->assertCount(2, $template['tree']['steps']);
        $this->assertStringContainsString(
            '"success_headline"',
            (string) json_encode($template['tree']['steps'][1]),
            'the terminal step has to offer the Slot Role its words bind to'
        );
    }

    /**
     * Nothing survives validation that the panel could not have produced. A
     * shipped entry losing so much as one key here is a design reachable only
     * by hand-editing JSON.
     */
    public function testEveryShippedTemplateIsExpressibleEntirelyInTheVocabulary(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);

        foreach (self::library()->all() as $id => $template) {
            $renormalized = $vocabulary->normalize($template);

            $this->assertSame($template['tree'], $renormalized['tree'], "{$id}: its tree is not expressible in the vocabulary");
            $this->assertSame($template['tokens'], $renormalized['tokens'], "{$id}: it names a token the vocabulary does not have");
            $this->assertNotSame([], $template['tokens'], "{$id}: a template with no tokens has no design");
        }
    }

    /**
     * The consent node is **off by default**: defaulting it on would put a
     * checkbox on the roughly 90% of installs that do not want one and cost
     * conversions for no gain (ADR 0032).
     */
    public function testNoShippedTemplateTurnsConsentOnForTheMerchant(): void
    {
        foreach (self::library()->all() as $id => $template) {
            $this->assertStringNotContainsString('"consent"', (string) json_encode($template['tree']), "{$id}: ships a consent node");
        }
    }
}
