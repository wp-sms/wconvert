<?php

namespace WConvert\Tests\Unit\Pro\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Template\ProTemplates;
use WConvert\Template\BundledTemplates;
use WConvert\Template\TemplateFacets;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * Pro's designs, composed the way `ProServiceProvider` composes them.
 *
 * Free once bundled a locked card for each of these; that file is gone (ADR
 * 0156). A design this install did not get is now a hosted catalogue entry,
 * so what remains to prove here is that Pro registers its real designs and
 * keeps every one free already had. Reading the container instead would need
 * WordPress; the value under test is the composition.
 */
#[CoversClass(ProTemplates::class)]
final class ProLibraryTest extends TestCase
{
    private const FREE_DIR = __DIR__ . '/../../../..';
    private const PRO_DIR = self::FREE_DIR . '/pro';

    private function library(): TemplateLibrary
    {
        return TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR),
            new ProTemplates(self::PRO_DIR),
        );
    }

    public function testFullscreenSetupsRegisterWithTheirProDesignsAndProEntitlement(): void
    {
        $templates = $this->library();
        $library = \WConvert\Playbook\PlaybookLibrary::fromDirectory(
            $templates,
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            \WConvert\Rules\RuleVocabulary::fromManifest(self::FREE_DIR),
            self::FREE_DIR,
            (new \WConvert\Pro\Template\ProPlaybooks(self::PRO_DIR))->entries()
        );
        self::assertSame([], $library->rejections());
        foreach (['fullscreen-newsletter', 'fullscreen-guide', 'fullscreen-announcement'] as $id) {
            $playbook = $library->find($id);
            self::assertNotNull($playbook);
            self::assertSame('fullscreen', $playbook->displayType);
            self::assertSame('pro', $templates->find($playbook->templateId)['tier']);
            self::assertNotContains('page_load', array_column($playbook->rules, 'type'));
        }
    }

    public function testQuestionStartsRegisterWithTheirPaidDesigns(): void
    {
        $templates = $this->library();
        $library = \WConvert\Playbook\PlaybookLibrary::fromDirectory(
            $templates,
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            \WConvert\Rules\RuleVocabulary::fromManifest(self::FREE_DIR),
            self::FREE_DIR,
            (new \WConvert\Pro\Template\ProPlaybooks(self::PRO_DIR))->entries()
        );
        self::assertSame([], $library->rejections());
        foreach (['product-finder', 'service-enquiry', 'content-guide'] as $id) {
            $playbook = $library->find($id);
            self::assertNotNull($playbook);
            self::assertSame('pro', $templates->find($playbook->templateId)['tier']);
            $vocabulary = TemplateVocabulary::fromManifest(self::FREE_DIR);
            $tree = \WConvert\Template\SlotRoles::bind(
                $vocabulary->withoutCopy($templates->find($playbook->templateId)['tree']),
                $playbook->copy,
                $vocabulary
            );
            self::assertNotSame('', $tree['steps'][0]['content']['children'][0]['text'] ?? '', $id . ' must start with a visible heading');
            $buttons = array_values(array_filter($tree['steps'][0]['content']['children'], static fn (array $node): bool => $node['type'] === 'button'));
            self::assertNotSame('', $buttons[0]['label'] ?? '', $id . ' must have a visible continue button');
        }
        self::assertCount(10, $library->servicing(\WConvert\Goal\Goal::FindMatch));
    }

    /**
     * ==========================================================================
     * THE WITHDRAWN CARD, AND WHY IT IS AN ASSERTION RATHER THAN A COMMENT.
     * ==========================================================================
     * `popup-spin-to-win` advertised a MECHANISM and not a design: a wheel that
     * allocates a prize. The payload is baked into HTML the full-page cache
     * serves byte-identically to every visitor, so either every segment's prize
     * ships in the page source or none does (ADR 0025); "one spin per visitor"
     * is a claim about a person, and WConvert mints no visitor identifier
     * (ADR 0017); and a stored outcome serves two purposes in two consent
     * categories at once, which is the question ADR 0052 parked and
     * **ADR 0053** answers.
     *
     * So the failure this guards is a pair, and both halves are one line
     * somebody adds:
     *
     * - the card coming back with nothing behind it — an upsell on a Pro
     *   install, for a design no tier can supply;
     * - a **tree** appearing under that id — which, since none of the three
     *   walls moved, could only be the wheel showing every visitor the same
     *   prize. That is the manufactured-urgency failure ADR 0052 refused,
     *   wearing a different hat.
     *
     * Reopening the decision therefore has to delete a test that names the ADR,
     * which is the point: it puts the argument in front of whoever reopens it
     * rather than behind a file they were not going to read.
     */
    public function testTheSpinToWinCardIsNeitherAdvertisedNorShipped(): void
    {
        $library = $this->library();

        $this->assertNull($library->find('popup-spin-to-win'), 'withdrawn by ADR 0053');
    }

    /**
     * Pro ships free's gallery too, so a customer does not lose the popups they
     * had. The one direction that would be wrong is Pro's designs appearing on
     * free, and free's tree cannot reach Pro's — which is what
     * `bin/verify-source-contract.sh` asserts one layer down.
     */
    public function testProKeepsEveryDesignFreeAlreadyHad(): void
    {
        $free = TemplateLibrary::from(
            TemplateVocabulary::fromManifest(self::FREE_DIR),
            new BundledTemplates(self::FREE_DIR),
        );

        $this->assertNotSame([], $free->all());
        $this->assertSame([], array_diff_key($free->all(), $this->library()->all()));
    }

    /** One bad file must not take the gallery down, and neither must no files. */
    public function testAnAbsentProLibraryIsAnEmptyListRatherThanAThrow(): void
    {
        $this->assertSame([], (new ProTemplates(__DIR__ . '/nowhere'))->entries());
    }
}
