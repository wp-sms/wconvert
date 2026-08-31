<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateVocabulary;

/**
 * Validation against the vocabulary manifest — which is what replaces
 * `wp_kses` here.
 *
 * A configuration template has no HTML and no CSS to sanitise, so "content,
 * never capability" stops being a rule enforced at a boundary and becomes a
 * shape that cannot express capability. What is left is closure: an unknown
 * node type and an unknown token are DROPPED, because the vocabulary is the
 * ceiling on design variety and a member nothing implements is a member the
 * visitor never sees (ADR 0010).
 */
#[CoversClass(TemplateVocabulary::class)]
final class TemplateVocabularyTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function vocabulary(): TemplateVocabulary
    {
        return TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
    }

    /**
     * @param array<string, mixed> $template
     * @return array<string, mixed>
     */
    private static function normalize(array $template): array
    {
        return self::vocabulary()->normalize($template);
    }

    public function testAnUnknownNodeTypeIsDropped(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [[
                'type' => 'stack',
                'children' => [
                    ['type' => 'heading', 'text' => 'Join'],
                    ['type' => 'carousel', 'slides' => 4],
                ],
            ]]],
        ]);

        $this->assertSame(
            [['type' => 'heading', 'text' => 'Join', 'id' => 'n1']],
            $normalized['tree']['steps'][0]['children']
        );
    }

    public function testAnUnknownTokenIsDropped(): void
    {
        $normalized = self::normalize(['tokens' => ['bg' => '#fff', 'wobble' => '3deg']]);

        $this->assertSame(['bg' => '#fff'], $normalized['tokens']);
    }

    public function testAnUnknownParamOnAKnownNodeIsDropped(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [['type' => 'heading', 'text' => 'Join', 'onclick' => 'alert(1)']]],
        ]);

        $this->assertSame(['type' => 'heading', 'text' => 'Join', 'id' => 'n1'], $normalized['tree']['steps'][0]);
    }

    public function testAnUnknownSlotRoleIsDroppedButTheNodeSurvives(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [['type' => 'heading', 'role' => 'shout', 'text' => 'Join']]],
        ]);

        $this->assertSame(['type' => 'heading', 'text' => 'Join', 'id' => 'n1'], $normalized['tree']['steps'][0]);
    }

    /**
     * A Slot Role is unique across a Template's WHOLE tree (CONTEXT.md, Slot
     * Role) — it is the key a Playbook binds copy to, and two nodes answering
     * to one Role means the copy lands on whichever the renderer reached
     * first.
     */
    public function testASlotRoleIsUniqueAcrossTheWholeTree(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => 'First'],
                ['type' => 'heading', 'role' => 'headline', 'text' => 'Second'],
            ]],
        ]);

        $this->assertSame('headline', $normalized['tree']['steps'][0]['role'] ?? null);
        $this->assertArrayNotHasKey('role', $normalized['tree']['steps'][1]);
    }

    /**
     * The one place a scheme can arrive from off-site, and the one thing
     * ADR 0013 asks PHP to validate at write.
     */
    public function testALinkHrefIsSchemeValidatedAtWrite(): void
    {
        $link = static fn (string $href): array => [
            'tree' => ['steps' => [[
                'type' => 'text',
                'text' => 'Our %s',
                'link' => ['label' => 'policy', 'href' => $href],
            ]]],
        ];

        $kept = self::normalize($link('https://example.test/privacy'));
        $dropped = self::normalize($link('javascript:alert(1)'));

        $this->assertSame('https://example.test/privacy', $kept['tree']['steps'][0]['link']['href']);
        $this->assertArrayNotHasKey('href', $dropped['tree']['steps'][0]['link']);
    }

    public function testTheTwoPanesOfASplitAreValidatedLikeAnyOtherChildren(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [[
                'type' => 'split',
                'ratio' => 0.4,
                'start' => [['type' => 'image', 'src' => '/x.png', 'alt' => '']],
                'end' => [['type' => 'marquee']],
            ]]],
        ]);

        $this->assertCount(1, $normalized['tree']['steps'][0]['start']);
        $this->assertSame([], $normalized['tree']['steps'][0]['end']);
        $this->assertSame(0.4, $normalized['tree']['steps'][0]['ratio']);
    }

    public function testATemplateThatIsNotATemplateNormalisesToAnEmptyOne(): void
    {
        $this->assertSame(['tree' => ['steps' => []], 'tokens' => []], self::normalize([]));
        $this->assertSame(['tree' => ['steps' => []], 'tokens' => []], self::normalize(['tree' => 'nonsense']));
    }

    /**
     * The consent checkbox's wording is a Slot Role like any other, so
     * switching Template does not destroy the merchant's version of it
     * (ADR 0032). A node that cannot carry the Role leaves it declared and
     * unreachable.
     */
    public function testAConsentNodeCanCarryItsSlotRole(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [['type' => 'consent', 'role' => 'consent_text', 'text' => 'I agree to the %s.']]],
        ]);

        $this->assertSame('consent_text', $normalized['tree']['steps'][0]['role'] ?? null);
    }

    /**
     * **A Template does not carry copy.** Whatever placeholder text it has is
     * for the gallery and "is never copied into an Optin" (CONTEXT.md,
     * Template) — that boundary is what keeps the library goal-agnostic and
     * therefore small.
     */
    public function testTakingACopyLeavesEveryWordBehindAndKeepsEverythingElse(): void
    {
        $stripped = self::vocabulary()->withoutCopy(['steps' => [[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => 'Get 10% off'],
                ['type' => 'field', 'name' => 'email', 'label' => 'Email', 'placeholder' => 'you@x.test', 'required' => true],
                ['type' => 'image', 'src' => '/tote.png', 'alt' => 'A tote bag'],
                ['type' => 'text', 'role' => 'fine_print', 'text' => 'Our %s', 'link' => ['label' => 'policy']],
            ],
        ]]]);

        [$heading, $field, $image, $fine] = $stripped['steps'][0]['children'];

        // The words go.
        $this->assertSame(['type' => 'heading', 'role' => 'headline'], $heading);
        $this->assertArrayNotHasKey('label', $field);
        $this->assertArrayNotHasKey('placeholder', $field);
        $this->assertArrayNotHasKey('text', $fine);
        $this->assertArrayNotHasKey('link', $fine);

        // The design stays — including the Slot Roles, which are the seam a
        // Playbook binds the words back onto.
        $this->assertSame('email', $field['name']);
        $this->assertTrue($field['required']);
        $this->assertSame('fine_print', $fine['role']);

        // And the image, because "a template's image slot keeps the template's
        // own asset or stays empty" and Playbooks never supply one (ADR 0013).
        $this->assertSame(['type' => 'image', 'src' => '/tote.png', 'alt' => 'A tote bag'], $image);
    }

    /**
     * **Slot visibility is a param, and which leaves may carry it is a
     * decision, not an oversight.**
     *
     * The settings panel edits slot content and slot visibility and never
     * arrangement (ADR 0010), so hiding a slot is how a merchant drops one —
     * and a `consent` node ships hidden, which is what makes ADR 0032's "off
     * by default" reachable from a panel that cannot add a node.
     *
     * `button` and `field` are excluded on purpose. Hiding the button that
     * converts leaves an Optin with no countable act, which is the state
     * `TemplateLibrary` refuses at registration; hiding a required field
     * leaves a form the capture endpoint refuses every submission of. Neither
     * declares `hidden`, so the key is DROPPED here rather than merely
     * disallowed further on — the renderer honours `hidden` on anything it is
     * handed, and this is the boundary that decides what it is ever handed.
     */
    public function testOnlyTheLeavesTheManifestNamesMayBeHidden(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [[
                'type' => 'stack',
                'children' => [
                    ['type' => 'heading', 'text' => 'Join', 'hidden' => true],
                    ['type' => 'text', 'text' => 'Fine print', 'hidden' => true],
                    ['type' => 'image', 'src' => '/x.png', 'hidden' => true],
                    ['type' => 'consent', 'text' => 'Email me', 'hidden' => true],
                    ['type' => 'field', 'name' => 'email', 'hidden' => true],
                    ['type' => 'button', 'label' => 'Join', 'action' => 'submit', 'hidden' => true],
                ],
            ]]],
        ]);

        $children = $normalized['tree']['steps'][0]['children'];

        foreach (array_slice($children, 0, 4) as $node) {
            $this->assertTrue($node['hidden'], sprintf('%s may be hidden', $node['type']));
        }

        foreach (array_slice($children, 4) as $node) {
            $this->assertArrayNotHasKey('hidden', $node, sprintf('%s may not be hidden', $node['type']));
        }
    }
}
