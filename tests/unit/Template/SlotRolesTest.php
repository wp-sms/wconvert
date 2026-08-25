<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateVocabulary;

/**
 * The seam between the two halves of a designed Optin.
 *
 * A [[Template]] declares which [[Slot Role]]s it offers, a [[Playbook]]
 * supplies copy against them, and neither needs to know the other's internals
 * — which is what lets the words survive switching Template (CONTEXT.md, Slot
 * Role).
 *
 * **A field's Roles are derived, not declared.** `resources/templates/manifest.json`
 * gives `field` an empty `roles` list, and the roles vocabulary nonetheless
 * names `email_label`, `email_placeholder` and their `name`/`phone` pairs. The
 * two are consistent: a field node carries no `role` key because it does not
 * need one — a field capturing an email cannot hold the phone label, so its
 * Roles follow from what it captures. `resources/renderer/src/render.ts` says
 * the same thing where it explains why two fields of one kind cannot collide.
 *
 * Deriving them is what keeps the manifest the only list. Spelling
 * `email_label → label` out again here would be the fifth hand-maintained
 * cross-cutting list this project has refused (ADR 0019).
 */
#[CoversClass(SlotRoles::class)]
final class SlotRolesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private function vocabulary(): TemplateVocabulary
    {
        return TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    /**
     * @param list<array<string, mixed>> $children
     * @return array{steps: list<array<string, mixed>>}
     */
    private static function tree(array $children): array
    {
        return ['steps' => [['type' => 'stack', 'children' => $children]]];
    }

    public function testANodeCarryingARoleDeclaresIt(): void
    {
        $tree = self::tree([['type' => 'heading', 'role' => 'headline', 'text' => 'x']]);

        $this->assertSame(['headline'], SlotRoles::declaredIn($tree, $this->vocabulary()));
    }

    /**
     * The derivation. A field capturing an email offers the email's label and
     * the email's placeholder, and nothing else — which is why the node
     * carries no `role` key at all.
     */
    public function testAFieldDeclaresTheRolesOfWhatItCaptures(): void
    {
        $tree = self::tree([['type' => 'field', 'name' => 'email']]);

        $this->assertSame(['email_label', 'email_placeholder'], SlotRoles::declaredIn($tree, $this->vocabulary()));
    }

    /**
     * Roles are unique across the Template's whole tree, not per step — the
     * terminal step's success headline is a different Role from the first
     * step's headline for exactly that reason (CONTEXT.md, Slot Role).
     */
    public function testRolesAreCollectedAcrossEveryStepAndEveryPane(): void
    {
        $tree = ['steps' => [
            ['type' => 'split',
                'start' => [['type' => 'heading', 'role' => 'headline', 'text' => 'x']],
                'end' => [['type' => 'text', 'role' => 'fine_print', 'text' => 'y']],
            ],
            ['type' => 'stack', 'children' => [['type' => 'heading', 'role' => 'success_headline', 'text' => 'z']]],
        ]];

        $this->assertSame(
            ['headline', 'fine_print', 'success_headline'],
            SlotRoles::declaredIn($tree, $this->vocabulary())
        );
    }

    /**
     * A node type that holds no words offers no Role, whatever it declares.
     * `image` is the case: a [[Playbook]] never supplies an image, so the
     * template's own asset stays or the slot stays empty (ADR 0013).
     */
    public function testANodeWithNoWordsInItOffersNoRole(): void
    {
        $tree = self::tree([['type' => 'image', 'role' => 'headline', 'src' => '/x.png']]);

        $this->assertSame([], SlotRoles::declaredIn($tree, $this->vocabulary()));
    }

    /**
     * Binding writes the words INTO the tree, against the keys the manifest
     * declares as copy — never against a key this class picked.
     */
    public function testBindingWritesAPlaybooksWordsAgainstTheRolesTheyName(): void
    {
        $tree = self::tree([
            ['type' => 'heading', 'role' => 'headline'],
            ['type' => 'field', 'name' => 'email'],
        ]);

        $bound = SlotRoles::bind($tree, [
            'headline' => 'Ten percent off',
            'email_label' => 'Email address',
            'email_placeholder' => 'you@example.com',
        ], $this->vocabulary());

        [$heading, $field] = $bound['steps'][0]['children'];

        $this->assertSame('Ten percent off', $heading['text']);
        $this->assertSame('Email address', $field['label']);
        $this->assertSame('you@example.com', $field['placeholder']);
    }

    /**
     * The one case that needs a link inside a sentence, expressed as
     * STRUCTURE rather than markup — a text with a placeholder plus a
     * `{label, href}` (ADR 0013).
     */
    public function testBindingWritesASentencesLinkAsStructure(): void
    {
        $tree = self::tree([['type' => 'text', 'role' => 'fine_print']]);

        $bound = SlotRoles::bind($tree, [
            'fine_print' => ['text' => 'See our %s', 'link' => ['label' => 'Privacy Policy']],
        ], $this->vocabulary());

        $node = $bound['steps'][0]['children'][0];

        $this->assertSame('See our %s', $node['text']);
        $this->assertSame(['label' => 'Privacy Policy'], $node['link']);
    }

    /**
     * A Role the tree does not offer writes nothing. This is the case
     * registration-time validation exists to make unreachable — a Playbook
     * whose default Template does not declare a Role it fills is rejected —
     * but the binder still has to be total, because a merchant may switch
     * Template afterwards and the words are meant to survive that.
     */
    public function testARoleTheTreeDoesNotOfferIsDroppedRatherThanInvented(): void
    {
        $tree = self::tree([['type' => 'heading', 'role' => 'headline']]);

        $bound = SlotRoles::bind($tree, ['headline' => 'Hi', 'success_body' => 'Nowhere to put this'], $this->vocabulary());

        $this->assertSame('Hi', $bound['steps'][0]['children'][0]['text']);
        $this->assertCount(1, $bound['steps'][0]['children']);
    }
}
