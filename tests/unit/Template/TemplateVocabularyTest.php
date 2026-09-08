<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateTree;
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
     * ==========================================================================
     * A SLOT ROLE REPEATS, AND THE SILENT DROP IT REPLACES WAS THE BUG.
     * ==========================================================================
     * This asserted the opposite until ADR 0051, and the uniqueness it enforced
     * was not free: a second node claiming a Role kept the NODE and lost the
     * Role, so `withoutCopy()` stripped its words at snapshot and `bind()` had
     * no Role to write them back through. What a visitor saw was an empty
     * paragraph — a three-benefit row showing one benefit and two blank lines,
     * with the gallery card looking correct because the library entry keeps its
     * placeholder text.
     *
     * The names are still closed and binding is still BY NAME, which is the
     * guarantee Roles exist for. Only the uniqueness went.
     */
    public function testASlotRoleMayBeClaimedByMoreThanOneNode(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => 'First'],
                ['type' => 'heading', 'role' => 'headline', 'text' => 'Second'],
            ]],
        ]);

        $this->assertSame('headline', $normalized['tree']['steps'][0]['role'] ?? null);
        $this->assertSame('headline', $normalized['tree']['steps'][1]['role'] ?? null);
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
        // Both keys always present, including empty, AND the version stamp: a
        // tree with no `v` is one written before the key existed, which is a
        // fact a migration would need and cannot reconstruct
        // ({@see \WConvert\Template\TemplateTree::VERSION}).
        $empty = ['tree' => ['v' => TemplateTree::VERSION, 'steps' => []], 'tokens' => []];

        $this->assertSame($empty, self::normalize([]));
        $this->assertSame($empty, self::normalize(['tree' => 'nonsense']));
    }

    /**
     * The version rides the tree wherever a tree is BUILT, which is three
     * places and not one — normalising on the way in, stripping the copy at
     * snapshot, and binding a [[Playbook]]'s words back into it. A path that
     * dropped it would store a design claiming to be older than it is, which
     * is worse than storing no version at all.
     */
    public function testEveryTreeThisVocabularyBuildsCarriesItsVersion(): void
    {
        $tree = ['steps' => [[
            'type' => 'stack',
            'children' => [['type' => 'heading', 'role' => 'headline', 'text' => 'Join']],
        ]]];

        $this->assertSame(TemplateTree::VERSION, self::normalize(['tree' => $tree])['tree']['v']);
        $this->assertSame(TemplateTree::VERSION, self::vocabulary()->withoutCopy($tree)['v']);
        $this->assertSame(
            TemplateTree::VERSION,
            SlotRoles::bind($tree, ['headline' => 'Hello'], self::vocabulary())['v']
        );
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

    /**
     * ========================================================================
     * A SCOPED BAG GOES THROUGH THE SAME CLOSURE THE DESIGN'S TOKENS DO.
     * ========================================================================
     * Every other param a node carries is a SCALAR, and the loop that keeps
     * them copies the value verbatim — which is safe exactly because there is
     * nothing inside a scalar to be unsafe. A token bag is a map, and it is the
     * first param that is, so the verbatim copy would have carried arbitrary
     * KEYS into `element.style.setProperty('--wc-' + name, value)`. That is a
     * property-name injection in the one place ADR 0010 claims none exists,
     * which is why ADR 0062 routes both scopes through one private `tokens()`
     * rather than trusting the caller (ADR 0062).
     */
    public function testAScopedTokenNameOutsideTheVocabularyIsDropped(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [[
                'type' => 'stack',
                'tokens' => ['bg' => '#fff4df', 'wobble' => '3deg', '--evil' => 'x'],
                'children' => [],
            ]]],
        ]);

        $this->assertSame(['bg' => '#fff4df'], $normalized['tree']['steps'][0]['tokens']);
    }

    /**
     * And a value that is not a scalar has no spelling as a custom property at
     * all, so a nested structure is refused rather than flattened into one.
     */
    public function testAScopedTokenValueThatIsNotAScalarIsDropped(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [[
                'type' => 'stack',
                'tokens' => ['bg' => ['#fff', 'url(javascript:alert(1))'], 'fg' => '#331e17'],
                'children' => [],
            ]]],
        ]);

        $this->assertSame(['fg' => '#331e17'], $normalized['tree']['steps'][0]['tokens']);
    }

    /**
     * A bag that survives to nothing leaves no key behind, so a design that
     * spelled one wrong is byte-identical to one that never spelled it — the
     * same equality the renderer's absent-versus-default cases turn on.
     */
    public function testABagThatKeepsNothingLeavesNoKey(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [['type' => 'row', 'tokens' => ['wobble' => '3deg'], 'children' => []]]],
        ]);

        $this->assertArrayNotHasKey('tokens', $normalized['tree']['steps'][0]);
    }

    /**
     * Every layout carries one, and a LEAF carries none — a bag re-declares
     * tokens for what is INSIDE a box, and a leaf has no inside.
     */
    public function testEveryLayoutMayCarryABagAndNoLeafMay(): void
    {
        $normalized = self::normalize([
            'tree' => ['steps' => [[
                'type' => 'stack',
                'tokens' => ['bg' => '#111'],
                'children' => [
                    ['type' => 'row', 'tokens' => ['bg' => '#222'], 'children' => []],
                    ['type' => 'grid', 'tokens' => ['bg' => '#333'], 'children' => []],
                    ['type' => 'split', 'tokens' => ['bg' => '#444'], 'start' => [], 'end' => []],
                    ['type' => 'heading', 'text' => 'Join', 'tokens' => ['bg' => '#555']],
                ],
            ]]],
        ]);

        $step = $normalized['tree']['steps'][0];

        $this->assertSame(['bg' => '#111'], $step['tokens']);

        foreach (array_slice($step['children'], 0, 3) as $node) {
            $this->assertArrayHasKey('tokens', $node, sprintf('%s may carry a bag', $node['type']));
        }

        $this->assertArrayNotHasKey('tokens', $step['children'][3]);
    }

    /**
     * The words come out with everything else that is not words, because a bag
     * is arrangement rather than copy: a [[Playbook]] fills a headline into a
     * design and never repaints it.
     */
    public function testACopyOfATreeKeepsItsScopedBags(): void
    {
        $stripped = self::vocabulary()->withoutCopy(['steps' => [[
            'type' => 'stack',
            'tokens' => ['bg' => '#fff4df'],
            'children' => [['type' => 'heading', 'text' => 'Join']],
        ]]]);

        $this->assertSame(['bg' => '#fff4df'], $stripped['steps'][0]['tokens']);
        $this->assertArrayNotHasKey('text', $stripped['steps'][0]['children'][0]);
    }
}
