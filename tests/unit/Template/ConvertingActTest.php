<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\ConvertingAct;

/**
 * Which converting act a tree offers — the question a [[Template]] is refused
 * for answering twice.
 *
 * **One Optin has exactly one converting act** (CONTEXT.md, Conversion). A
 * Template offering both a form and a click-through CTA is rejected when it is
 * REGISTERED, not disambiguated at runtime, because an Optin with two
 * candidate Conversions has no honest number to report (ADR 0020).
 */
#[CoversClass(ConvertingAct::class)]
final class ConvertingActTest extends TestCase
{
    /**
     * @param list<array<string, mixed>> $children
     * @return array<string, mixed>
     */
    private static function step(array $children): array
    {
        return ['steps' => [['type' => 'stack', 'children' => $children]]];
    }

    public function testAFormsSubmitIsTheSubmitAct(): void
    {
        $tree = self::step([['type' => 'button', 'label' => 'Join', 'action' => 'submit']]);

        $this->assertSame([ConvertingAct::Submit], ConvertingAct::offeredIn($tree));
    }

    /**
     * An omitted `action` is a submit, which is the same default the renderer
     * takes — `resources/renderer/src/render.ts` treats anything that is not
     * `link` as a form button. Two defaults that disagreed would put the
     * beacon on one node and the conversion on another.
     */
    public function testAButtonWithNoDeclaredActionSubmits(): void
    {
        $tree = self::step([['type' => 'button', 'label' => 'Join']]);

        $this->assertSame([ConvertingAct::Submit], ConvertingAct::offeredIn($tree));
    }

    public function testACtaThatNavigatesIsTheClickAct(): void
    {
        $tree = self::step([['type' => 'button', 'label' => 'Shop', 'action' => 'link', 'href' => 'https://x.test']]);

        $this->assertSame([ConvertingAct::Click], ConvertingAct::offeredIn($tree));
    }

    /**
     * The rejection this exists for. Found in a `split`'s far pane, because
     * that is exactly where a second converting act hides from a reader.
     */
    public function testATreeOfferingBothActsOffersTwo(): void
    {
        $tree = ['steps' => [[
            'type' => 'split',
            'start' => [['type' => 'button', 'label' => 'Join', 'action' => 'submit']],
            'end' => [['type' => 'button', 'label' => 'Shop', 'action' => 'link']],
        ]]];

        $this->assertSame([ConvertingAct::Submit, ConvertingAct::Click], ConvertingAct::offeredIn($tree));
    }

    /**
     * Two buttons of the SAME act is one act, not two. A design with a
     * primary and a secondary submit still has one number to report.
     */
    public function testTwoButtonsOfOneActAreStillOneAct(): void
    {
        $tree = self::step([
            ['type' => 'button', 'label' => 'Join', 'action' => 'submit'],
            ['type' => 'button', 'label' => 'Join now', 'action' => 'submit'],
        ]);

        $this->assertSame([ConvertingAct::Submit], ConvertingAct::offeredIn($tree));
    }

    public function testATreeWithNoButtonOffersNothing(): void
    {
        $this->assertSame([], ConvertingAct::offeredIn(self::step([['type' => 'heading', 'text' => 'Hi']])));
    }

    /**
     * A submit-metered Template has TWO steps and a click-metered one has ONE
     * — the click navigates the visitor away, so there is no success state
     * left to render (ADR 0010, corrected by ADR 0025).
     */
    public function testTheActDecidesHowManyStepsItsTemplateHas(): void
    {
        $this->assertSame(2, ConvertingAct::Submit->steps());
        $this->assertSame(1, ConvertingAct::Click->steps());
    }
}
