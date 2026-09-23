<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateTree;
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

    public function testADeferredLibraryRetriesAFailedBuildAndKeepsOnlyTheSuccessfulResult(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $attempts = 0;
        $library = TemplateLibrary::deferred(
            $vocabulary,
            static function () use (&$attempts, $vocabulary): TemplateLibrary {
                $attempts++;
                if ($attempts === 1) {
                    throw new \RuntimeException('temporary read failure');
                }

                return TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);
            }
        );

        try {
            $library->all();
            $this->fail('The first catalog read should fail.');
        } catch (\RuntimeException $error) {
            $this->assertSame('temporary read failure', $error->getMessage());
        }

        $this->assertNotNull($library->find('centred-card'));
        $this->assertNotSame([], $library->all());
        $this->assertSame(2, $attempts, 'the successful catalog was rebuilt after it had already been cached');
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
     * **Consent capture is off by default, and reachable in one click.**
     *
     * Those used to be in tension. ADR 0032 makes the `consent` node
     * first-class "rather than a required field the merchant hand-adds",
     * because one the merchant remembers to add is one the merchant forgets —
     * while defaulting it ON would put a checkbox on the roughly 90% of
     * installs that do not want one and cost conversions for no gain. With no
     * way to express "present but off", shipping no node at all was the only
     * reading of the second half available, and it quietly gave up the first.
     *
     * Slot visibility is what settles it (ADR 0010): every capture design
     * ships the node HIDDEN, so the panel — which edits content and visibility
     * and never arrangement — can switch it on without the merchant knowing
     * the vocabulary has such a thing.
     *
     * A click-metered design ships none, and that is not an omission: it
     * captures nothing, so there is nothing to consent to.
     */
    public function testEveryCaptureDesignShipsConsentHiddenRatherThanNotAtAll(): void
    {
        foreach (self::library()->all() as $id => $template) {
            $captures = ConvertingAct::offeredIn($template['tree']) === [ConvertingAct::Submit];
            $nodes = self::consentNodesIn($template['tree']);

            $this->assertCount(
                $captures ? array_sum(array_map(static fn (array $s): int => count($s['consents']), $template['tree']['submissions'])) : 0,
                $nodes,
                "{$id}: a capture design offers consent capture, and nothing else offers it"
            );

        }
    }

    /**
     * @param array<string, mixed> $tree
     * @return list<array<string, mixed>>
     */
    private static function consentNodesIn(array $tree): array
    {
        $found = [];
        $stack = is_array($tree['steps'] ?? null) ? $tree['steps'] : [];

        while ($stack !== []) {
            $node = array_pop($stack);

            if (!is_array($node)) {
                continue;
            }

            if (($node['type'] ?? null) === 'consent') {
                $found[] = $node;
            }

            foreach (TemplateTree::childrenOf($node) as $child) {
                $stack[] = $child;
            }
        }

        return $found;
    }
}
