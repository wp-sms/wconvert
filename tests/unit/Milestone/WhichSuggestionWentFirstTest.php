<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\EditedPart;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * ============================================================================
 * THE MILESTONE THAT READS THE TAXONOMY DIRECTLY.
 * ============================================================================
 * The [[Goal]] and [[Playbook]] catalogue was derived by classifying 462
 * listings and 670 reviews down to five Goals, and nothing has yet challenged
 * that guess. **What a merchant changes first, and in which Playbook, is the
 * sharpest available signal that a Goal's defaults are wrong** (#94).
 *
 * The diff runs against a REAL prefilled config — `welcome-discount`, through
 * the same {@see Prefill} the creation flow uses — rather than against a
 * hand-built fixture, because the property under test is about what a Playbook
 * actually writes. A fixture would let the parts and the prefill drift apart
 * and agree with each other while doing so.
 */
#[CoversClass(EditedPart::class)]
final class WhichSuggestionWentFirstTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private TemplateVocabulary $templates;

    /** @var array<string, mixed> */
    private array $suggested;

    private string $goal;

    protected function setUp(): void
    {
        $this->templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);

        $rules = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $designs = TemplateLibrary::fromDirectory($this->templates, self::PLUGIN_DIR);

        $draft = (new Prefill(
            PlaybookLibrary::fromDirectory($designs, $this->templates, $rules, self::PLUGIN_DIR),
            $designs,
            $this->templates,
            InstalledRules::withPro($rules)
        ))->fromPlaybook('welcome-discount');

        $this->assertNotNull($draft, 'welcome-discount is a bundled Playbook');

        $this->suggested = $draft['config'];
        $this->goal = $draft['goal'];
    }

    /**
     * @param array<string, mixed> $after
     */
    private function change(array $after, ?string $goal = null): ?EditedPart
    {
        return EditedPart::firstChangedBetween(
            $this->suggested,
            $after,
            $this->goal,
            $goal ?? $this->goal,
            $this->templates
        );
    }

    public function testAnUntouchedDraftHasChangedNothing(): void
    {
        $this->assertNull($this->change($this->suggested));
    }

    /**
     * **A save that reorders keys is not an edit.** The builder sends the
     * whole draft back on every save, and what a `PUT` carries is a JSON
     * object round-tripped through a browser — so a comparison that read key
     * order as meaning would record a first edit on the first save that
     * changed nothing at all.
     */
    public function testTheSameConfigInADifferentKeyOrderIsNotAnEdit(): void
    {
        $reordered = array_reverse($this->suggested, true);

        $this->assertNotSame(array_keys($this->suggested), array_keys($reordered));
        $this->assertNull($this->change($reordered));
    }

    public function testCorrectingTheGoalIsTheSharpestOfThem(): void
    {
        $this->assertSame(EditedPart::Goal, $this->change($this->suggested, 'cart_recovery'));
    }

    public function testRewritingAWordIsACopyChange(): void
    {
        $edited = $this->suggested;
        $edited['template']['tree'] = SlotRoles::bind($edited['template']['tree'], ['headline' => 'Ten percent off, today only'], $this->templates);

        $this->assertSame(EditedPart::Copy, $this->change($edited));
    }

    public function testRestylingIsADesignChange(): void
    {
        $edited = $this->suggested;
        $edited['template']['tokens']['color.accent'] = '#ff0055';

        $this->assertSame(EditedPart::Design, $this->change($edited));
    }

    public function testPickingADifferentDesignIsADesignChange(): void
    {
        $edited = $this->suggested;
        $edited['template_id'] = 'popup-something-else';

        $this->assertSame(EditedPart::Design, $this->change($edited));
    }

    public function testChangingWhenItShowsIsARulesChange(): void
    {
        $edited = $this->suggested;
        $edited['display_rules'] = \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'exit_intent']]);

        $this->assertSame(EditedPart::Rules, $this->change($edited));
    }

    /**
     * A Playbook that supplied no targeting suggested **everywhere**, so
     * narrowing it is still overriding an answer rather than filling a blank.
     */
    public function testNarrowingWhereItShowsIsATargetingChange(): void
    {
        $edited = $this->suggested;
        $edited['targeting'] = ['include' => [['type' => 'front_page']]];

        $this->assertSame(EditedPart::Targeting, $this->change($edited));
    }

    /**
     * ========================================================================
     * THE TIE-BREAK, WHICH IS NOT AN IMPLEMENTATION DETAIL.
     * ========================================================================
     * The builder saves the whole draft, so a single `PUT` can move three of
     * these at once and "which was first" has no answer inside it. The order
     * of {@see EditedPart}'s cases IS the answer, and it is sharpest
     * indictment first — with **copy last, because every merchant changes the
     * words**. A Playbook's copy is generic by construction, so letting it win
     * a tie would hide the one edit that carried information.
     */
    public function testWhenOneSaveChangesSeveralTheSharpestOneIsRecorded(): void
    {
        $withCopy = $this->suggested;
        $withCopy['template']['tree'] = SlotRoles::bind($withCopy['template']['tree'], ['headline' => 'Ten percent off'], $this->templates);

        $andRules = $withCopy;
        $andRules['display_rules'] = \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'exit_intent']]);

        $andDesign = $andRules;
        $andDesign['template']['tokens']['color.accent'] = '#ff0055';

        $this->assertSame(EditedPart::Copy, $this->change($withCopy));
        $this->assertSame(EditedPart::Rules, $this->change($andRules));
        $this->assertSame(EditedPart::Design, $this->change($andDesign));
        $this->assertSame(EditedPart::Goal, $this->change($andDesign, 'cart_recovery'));
    }

    /**
     * ========================================================================
     * FILLING A BLANK THE PLAYBOOK LEFT ON PURPOSE IS NOT AN OVERRIDE.
     * ========================================================================
     * Prefill **binds no [[Destination]]** — *"prefill never binds a
     * Destination invisibly"* (CONTEXT.md, Playbook) — and writes neither a
     * [[Frequency]], a [[Schedule]] nor a priority. A merchant setting one of
     * those is doing the work the Playbook handed them, which is the Playbook
     * working rather than failing, and recording it as a rejected suggestion
     * would poison the one signal this milestone exists to collect.
     */
    public function testSettingsNotSuggestedByThePlaybookAreNotAnOverride(): void
    {
        foreach (
            [
                'destinations' => ['01J0000000000000000000000A'],
                'starts_at' => '2026-03-04T09:00',
                'priority' => 5,
            ] as $key => $value
        ) {
            $edited = $this->suggested;
            $edited[$key] = $value;

            $this->assertNull($this->change($edited), "{$key} is not a Playbook suggestion");
        }
    }

    /**
     * `playbook_id` is **provenance** and cannot be edited into anything —
     * asserted so that a config which somehow carried a different one is not
     * read as the merchant having changed a suggestion.
     */
    public function testProvenanceIsNotASuggestion(): void
    {
        $edited = $this->suggested;
        $edited['playbook_id'] = 'something-else';

        $this->assertNull($this->change($edited));
    }

    /**
     * ========================================================================
     * NO PART IS DEAD, AND THE WALK IS THE SCENARIOS ABOVE.
     * ========================================================================
     * Every case of {@see EditedPart} is produced by one of the named changes
     * in this file, so a sixth case added without a scenario fails here rather
     * than shipping as a value no screen ever renders.
     *
     * It is deliberately not a walk over whole config keys. Replacing
     * `template` wholesale moves the design AND the words, and the tie-break
     * correctly reports {@see EditedPart::Design} — so a crude walk can never
     * reach {@see EditedPart::Copy}, and the one that could would be a walk
     * that had to know where a word lives.
     */
    public function testEveryPartIsProducedByOneOfTheseScenarios(): void
    {
        $goal = $this->suggested;

        $copy = $this->suggested;
        $copy['template']['tree'] = SlotRoles::bind($copy['template']['tree'], ['headline' => 'Ten percent off'], $this->templates);

        $design = $this->suggested;
        $design['template']['tokens']['color.accent'] = '#ff0055';

        $rules = $this->suggested;
        $rules['display_rules'] = \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'exit_intent']]);

        $targeting = $this->suggested;
        $targeting['targeting'] = ['include' => [['type' => 'front_page']]];

        $produced = [
            $this->change($goal, 'cart_recovery'),
            $this->change($design),
            $this->change($rules),
            $this->change($targeting),
            $this->change($copy),
        ];

        $this->assertSame(EditedPart::cases(), $produced);
    }
}
