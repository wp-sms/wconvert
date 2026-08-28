<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\ConvertingAct;
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

    /**
     * **The structure editor lists layouts as rows and offers them in its Add
     * menu**, so a layout added to the manifest and not named here would draw a
     * row reading `grid` — the same failure `success_headline` was, one level
     * of the vocabulary up.
     */
    public function testEveryLayoutIsNamed(): void
    {
        $this->assertNamesExactly(
            array_map('strval', array_keys(self::manifest()['layouts'])),
            TemplateLabels::layouts(),
            'layouts'
        );
    }

    public function testEveryFieldKindIsNamed(): void
    {
        /** @var list<string> $fields */
        $fields = self::manifest()['fields'];

        $this->assertNamesExactly($fields, TemplateLabels::fields(), 'field kinds');
    }

    /**
     * **The ⇄ control writes these**, so a kind added to the manifest without
     * one would swap a field into a kind whose example is the word `phone`.
     */
    public function testEveryFieldKindHasAnExample(): void
    {
        /** @var list<string> $fields */
        $fields = self::manifest()['fields'];

        $this->assertNamesExactly($fields, TemplateLabels::placeholders(), 'field placeholders');
    }

    public function testEveryTokenIsNamed(): void
    {
        $this->assertNamesExactly(array_map('strval', array_keys(self::manifest()['tokens'])), TemplateLabels::tokens(), 'tokens');
    }

    /**
     * ==========================================================================
     * THE ⇄ MENU'S WORDS ARE THEIR OWN MAP, ANCHORED TO THE ENUM.
     * ==========================================================================
     * They cannot live in {@see TemplateLabels::keys()}, which the test below
     * pins to exactly the content keys — a label for `action` in there would be
     * a control the editor must not offer as words.
     *
     * The manifest declares no list of `action` values to assert against, and
     * adding one would be a fifth hand-maintained cross-cutting list (ADR 0019)
     * for data PHP already owns: {@see ConvertingAct} is the closed set, and
     * `action()` is where each act's node spelling lives. So parity is asked of
     * the enum, in both directions — a third act would arrive unnamed, and a
     * label for an action nothing produces would be a word for a state that
     * cannot exist.
     */
    public function testEveryButtonActionIsNamedAndNothingElseIs(): void
    {
        $this->assertNamesExactly(
            array_map(static fn (ConvertingAct $act): string => $act->action(), ConvertingAct::cases()),
            TemplateLabels::params(),
            'button actions'
        );
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
