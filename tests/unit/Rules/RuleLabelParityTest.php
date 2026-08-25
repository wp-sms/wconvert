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
    }
}
