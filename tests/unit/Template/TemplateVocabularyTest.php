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
            [['type' => 'heading', 'text' => 'Join']],
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

        $this->assertSame(['type' => 'heading', 'text' => 'Join'], $normalized['tree']['steps'][0]);
    }

    public function testAnUnknownSlotRoleIsDroppedButTheNodeSurvives(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [['type' => 'heading', 'role' => 'shout', 'text' => 'Join']]],
        ]);

        $this->assertSame(['type' => 'heading', 'text' => 'Join'], $normalized['tree']['steps'][0]);
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
     * Every Slot Role a tree declares, which is what the Playbook registry
     * validates a Playbook's copy against at registration.
     */
    public function testTheRolesATreeDeclaresIncludeTheOnesAFieldImplies(): void
    {
        $roles = self::vocabulary()->rolesIn([
            'steps' => [[
                'type' => 'stack',
                'children' => [
                    ['type' => 'heading', 'role' => 'headline', 'text' => 'Join'],
                    ['type' => 'field', 'name' => 'email'],
                ],
            ]],
        ]);

        $this->assertSame(['headline', 'email_label', 'email_placeholder'], $roles);
    }
}
