<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateLabels;
use WConvert\Template\TemplateManifest;

/**
 * The template manifest and its WORDS say the same thing.
 *
 * ADR 0013 splits data from words for [[Playbook]]s, and this is the same
 * split read from the other end: the manifest is one file both runtimes read,
 * so the words come OUT of it into {@see TemplateLabels} rather than the data
 * going into PHP.
 *
 * It fails in **both** directions — a vocabulary member with no label, and a
 * label for something the manifest does not declare. One direction would let
 * the settings panel draw a control headed `success_headline`, and the other
 * would leave translated strings for slots that no longer exist.
 */
#[CoversClass(TemplateLabels::class)]
final class TemplateLabelParityTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * @return array<string, mixed>
     */
    private static function manifest(): array
    {
        return TemplateManifest::load(self::PLUGIN_DIR);
    }

    /**
     * @param list<string> $declared
     * @param array<string, string> $labels
     */
    private function assertNamesExactly(array $declared, array $labels, string $what): void
    {
        sort($declared);
        $named = array_keys($labels);
        sort($named);

        $this->assertNotSame([], $declared, sprintf('the manifest declares no %s, so this asserts nothing', $what));
        $this->assertSame($declared, $named, sprintf('the %s and their labels disagree', $what));
    }

    public function testEverySlotRoleIsNamed(): void
    {
        /** @var list<string> $roles */
        $roles = self::manifest()['roles'];

        $this->assertNamesExactly($roles, TemplateLabels::roles(), 'Slot Roles');
    }

    public function testEveryLeafIsNamed(): void
    {
        $this->assertNamesExactly(array_map('strval', array_keys(self::manifest()['nodes'])), TemplateLabels::nodes(), 'leaves');
    }

    public function testEveryFieldKindIsNamed(): void
    {
        /** @var list<string> $fields */
        $fields = self::manifest()['fields'];

        $this->assertNamesExactly($fields, TemplateLabels::fields(), 'field kinds');
    }

    public function testEveryTokenIsNamed(): void
    {
        $this->assertNamesExactly(array_map('strval', array_keys(self::manifest()['tokens'])), TemplateLabels::tokens(), 'tokens');
    }

    /**
     * The panel edits a leaf's CONTENT keys — what it says — and never its
     * params, which are arrangement and behaviour. So this is the union of
     * every `content` list and nothing beyond it: a label for `level` or
     * `action` would be a control the panel must not offer.
     */
    public function testEveryEditableKeyIsNamedAndNothingElseIs(): void
    {
        $keys = [];

        foreach (self::manifest()['nodes'] as $node) {
            foreach ($node['content'] as $key) {
                $keys[$key] = true;
            }
        }

        $this->assertNamesExactly(array_map('strval', array_keys($keys)), TemplateLabels::keys(), 'content keys');
    }
}
