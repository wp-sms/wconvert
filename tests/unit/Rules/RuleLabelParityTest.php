<?php

namespace WConvert\Tests\Unit\Rules;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rules\RuleLabels;
use WConvert\Rules\RuleManifest;

/**
 * The manifest and its WORDS say the same thing.
 *
 * ADR 0013 splits data from words for [[Playbook]]s — bundled entries are PHP
 * so `wp i18n make-pot` can see the copy — and the rule vocabulary is the same
 * split read from the other end: the manifest is one file both runtimes read,
 * so the words come OUT of it into {@see RuleLabels} rather than the data
 * going into PHP.
 *
 * That leaves one hand-written duplicate, which is exactly what ADR 0005
 * allows on the condition that a test asserts parity. This is that test, and
 * it fails in **both** directions — an entry with no label, and a label for
 * something the manifest does not declare. One direction would let the
 * vocabulary grow a control the builder draws with a raw key in it, and the
 * other would leave translated strings for rules that no longer exist.
 */
#[CoversClass(RuleLabels::class)]
final class RuleLabelParityTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /** @return array<string, array<string, mixed>> Rule type => its entry. */
    private static function entries(): array
    {
        $entries = [];

        foreach (RuleManifest::load(self::PLUGIN_DIR) as $axis) {
            foreach ($axis as $type => $entry) {
                $entries[(string) $type] = $entry;
            }
        }

        return $entries;
    }

    public function testEveryRuleTypeIsNamed(): void
    {
        $this->assertSame(
            [],
            array_diff(array_keys(self::entries()), array_keys(RuleLabels::types())),
            'a rule type the builder would draw with its raw key'
        );
    }

    public function testNothingIsNamedThatTheManifestDoesNotDeclare(): void
    {
        $this->assertSame(
            [],
            array_diff(array_keys(RuleLabels::types()), array_keys(self::entries())),
            'a label for a rule type the vocabulary no longer has'
        );
    }

    /**
     * Params are keyed `type.param` because the same name means different
     * things under different types: `query_param`'s `value` is what the
     * parameter must equal, and a Targeting rule's `value` is the page it
     * names.
     */
    public function testEveryParamIsNamed(): void
    {
        $declared = [];

        foreach (self::entries() as $type => $entry) {
            foreach (array_keys($entry['params']) as $param) {
                $declared[] = $type . '.' . $param;
            }
        }

        $this->assertSame([], array_diff($declared, array_keys(RuleLabels::params())), 'an unnamed param');
        $this->assertSame([], array_diff(array_keys(RuleLabels::params()), $declared), 'a label for no param');
    }

    public function testEveryPresetIsNamed(): void
    {
        $declared = [];

        foreach (self::entries() as $type => $entry) {
            foreach (array_keys($entry['presets']) as $preset) {
                $declared[] = $type . '.' . $preset;
            }
        }

        $this->assertSame([], array_diff($declared, array_keys(RuleLabels::presets())), 'an unnamed preset');
        $this->assertSame([], array_diff(array_keys(RuleLabels::presets()), $declared), 'a label for no preset');
    }

    /**
     * ========================================================================
     * A PHRASE IS OWED BY THE TWO CLIENT AXES AND BY NEITHER TARGETING TYPE.
     * ========================================================================
     * The When and Who sections summarise themselves by READING their rules,
     * so a trigger or condition with no phrase leaves a section headed by its
     * own control names. The Where section summarises itself by COUNTING —
     * naming pages needs an async lookup that would flicker and would go blank
     * the day it 500s — so a Targeting phrase would be a translated string
     * with no reader.
     *
     * Both directions, like every other parity assertion here.
     */
    public function testEveryTriggerAndConditionReadsInsideASentence(): void
    {
        $this->assertSame(
            [],
            array_diff(self::typesOn(['triggers', 'conditions']), array_keys(RuleLabels::phrases())),
            'a rule whose section summary would fall back to its control name'
        );
    }

    public function testNoTargetingTypeCarriesAPhrase(): void
    {
        $this->assertSame(
            [],
            array_intersect(self::typesOn(['targeting']), array_keys(RuleLabels::phrases())),
            'the Where section counts its rules; a phrase here has no reader'
        );
    }

    public function testNothingReadsInsideASentenceThatTheManifestDoesNotDeclare(): void
    {
        $this->assertSame(
            [],
            array_diff(array_keys(RuleLabels::phrases()), array_keys(self::entries())),
            'a phrase for a rule type the vocabulary no longer has'
        );
    }

    /**
     * **A preset phrase is optional and its key is not.**
     *
     * A preset with no phrase falls back to its type's with the fixed values
     * substituted back in, which reads correctly — so this asserts one
     * direction only: nothing may be phrased that the manifest does not
     * declare. Asserting the other would force a phrase onto a preset that
     * reads fine without one.
     */
    public function testNoPresetIsPhrasedThatTheManifestDoesNotDeclare(): void
    {
        $declared = [];

        foreach (self::entries() as $type => $entry) {
            foreach (array_keys($entry['presets']) as $preset) {
                $declared[] = $type . '.' . $preset;
            }
        }

        $this->assertSame(
            [],
            array_diff(array_keys(RuleLabels::presetPhrases()), $declared),
            'a phrase for a preset the vocabulary no longer has'
        );
    }

    /**
     * **A preset phrase carries one placeholder per param it does NOT fix.**
     *
     * That is the rule that makes a preset a shortcut rather than a second
     * spelling of its type: `after_a_moment` fixes `seconds` and reads with no
     * placeholder, `utm_source` fixes `key` and reads with one. A phrase with
     * a placeholder too many prints a literal `%2$s` at a merchant; one too
     * few silently drops the only thing they typed.
     */
    public function testAPresetPhraseTakesExactlyTheParamsItLeavesOpen(): void
    {
        $checked = 0;

        foreach (self::entries() as $type => $entry) {
            foreach ($entry['presets'] as $preset => $fixed) {
                $phrase = RuleLabels::presetPhrase((string) $type, (string) $preset);

                if ($phrase === null) {
                    continue;
                }

                $open = array_diff(array_keys($entry['params']), array_keys((array) $fixed));

                $this->assertSame(
                    count($open),
                    preg_match_all('/%\d+\$s/', $phrase),
                    sprintf('%s.%s leaves %d param(s) open', $type, $preset, count($open))
                );

                $checked++;
            }
        }

        $this->assertGreaterThan(0, $checked, 'no phrased preset to check, so this asserts nothing');
    }

    /**
     * **The two time-of-day presets carry no phrase, and it is a choice.**
     *
     * A preset phrase replaces the type's, so *"During office hours"* as a
     * sentence would hide the window behind it — and 09:00 to 17:00 is a
     * starting point rather than a claim about THIS merchant's hours. With no
     * phrase the summary falls back to the type's with the hours substituted
     * in, so the row reads out the window the Optin actually has.
     *
     * Pinned by name rather than derived, for the reason `on_absence: suspend`
     * is pinned by name in `RuleManifestParityTest`: the whole point is that
     * somebody chose it, and one quietly gaining a phrase would replace a
     * merchant's own hours with a label on every row that used it.
     */
    public function testTheTimeOfDayPresetsReadOutTheirHoursRatherThanTheirName(): void
    {
        foreach (['office_hours', 'evenings'] as $preset) {
            $this->assertNull(
                RuleLabels::presetPhrase('time_of_day', $preset),
                sprintf('time_of_day.%s must read as the window it fixed', $preset)
            );
        }
    }

    /**
     * And the same of a type's own phrase: one placeholder per declared param.
     */
    public function testATypePhraseTakesExactlyItsDeclaredParams(): void
    {
        foreach (RuleLabels::phrases() as $type => $phrase) {
            $this->assertSame(
                count(self::entries()[$type]['params']),
                preg_match_all('/%\d+\$s/', $phrase),
                $type
            );
        }
    }

    /**
     * **Positional, never bare.** A translator whose language puts the object
     * first cannot reorder `%s`, and `query_param` needs two.
     */
    public function testEveryPlaceholderIsPositional(): void
    {
        foreach ([...RuleLabels::phrases(), ...RuleLabels::presetPhrases()] as $key => $phrase) {
            // `%%` is an escaped literal sign and is not a placeholder —
            // `scroll_depth` needs one.
            $this->assertSame(0, preg_match_all('/(?<!%)%(?![%\d])/', $phrase), (string) $key);
        }
    }

    /**
     * @param list<string> $axes
     * @return list<string>
     */
    private static function typesOn(array $axes): array
    {
        $types = [];

        foreach (RuleManifest::load(self::PLUGIN_DIR) as $axis => $entries) {
            if (in_array((string) $axis, $axes, true)) {
                $types = [...$types, ...array_map('strval', array_keys($entries))];
            }
        }

        return $types;
    }

    /**
     * Only the option sets the vocabulary knows when it is WRITTEN are named
     * here. A `post_type`'s options are a fact about the install, and
     * WordPress already holds the merchant's own words for them — a custom
     * post type's label is whatever its author registered.
     */
    public function testEveryClosedOptionIsNamed(): void
    {
        $declared = [];

        foreach (self::entries() as $entry) {
            foreach ($entry['params'] as $param) {
                foreach (is_array($param['options'] ?? null) ? $param['options'] : [] as $option) {
                    $declared[] = $param['control'] . '.' . (string) $option;
                }
            }
        }

        $this->assertNotSame([], $declared, 'no closed option set to check, so this asserts nothing');
        $this->assertSame([], array_diff($declared, array_keys(RuleLabels::options())), 'an unnamed option');
        $this->assertSame([], array_diff(array_keys(RuleLabels::options()), $declared), 'a label for no option');
        $this->assertSame([], array_diff(array_keys(RuleLabels::optionPhrases()), $declared), 'a phrase for no option');
    }
}
