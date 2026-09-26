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

    public function testImportedContactAndConsentReferencesSurviveNormalizationAndAnotherSave(): void
    {
        $tree = json_decode((string) file_get_contents(self::PLUGIN_DIR . '/tests/fixtures/journey-graph-split-capture.json'), true);
        $tree['steps'][2]['content']['children'][0]['id'] = 'contact_email';
        $tree['steps'][2]['content']['children'][] = ['type' => 'consent', 'id' => 'privacy', 'text' => 'I agree'];
        $tree['submissions'][0]['fields'] = ['contact_email'];
        $tree['submissions'][0]['consents'] = ['privacy'];
        self::assertNull(\WConvert\Template\CaptureContract::issue(['template' => ['tree' => $tree]], 'collect_enquiries', ''));
        $normalized = self::normalize(['tree' => $tree])['tree'];
        $field = $normalized['steps'][2]['content']['children'][0]['id'];
        $consent = $normalized['steps'][2]['content']['children'][2]['id'];
        self::assertMatchesRegularExpression('/^n[1-9][0-9]*$/', $field);
        self::assertSame([$field], $normalized['submissions'][0]['fields']);
        self::assertSame([$consent], $normalized['submissions'][0]['consents']);
        self::assertNull(\WConvert\Template\CaptureContract::issue(['template' => ['tree' => $normalized]], 'collect_enquiries', ''));
        self::assertSame($normalized, self::normalize(['tree' => $normalized])['tree']);
        $tree['submissions'][0]['fields'][] = 'missing_field';
        self::assertContains('missing_field', self::normalize(['tree' => $tree])['tree']['submissions'][0]['fields']);
    }

    public function testMissingCanonicalReferencesDoNotAttachToNewlyMintedFields(): void
    {
        $tree = json_decode((string) file_get_contents(self::PLUGIN_DIR . '/tests/fixtures/journey-graph-split-capture.json'), true);
        unset($tree['steps'][2]['content']['children'][0]['id']);
        $tree['submissions'][0]['fields'] = ['n1'];
        $normalized = self::normalize(['tree' => $tree])['tree'];
        self::assertNotSame('n1', $normalized['steps'][2]['content']['children'][0]['id']);
        self::assertSame(['n1'], $normalized['submissions'][0]['fields']);
        self::assertSame('references', \WConvert\Template\CaptureContract::issue(['template' => ['tree' => $normalized]], 'collect_enquiries', ''));
    }

    public function testQuestionReferencesChangeWithoutRenamingScreensEdgesAnswersOrSubmissions(): void
    {
        $when = ['match' => 'all', 'clauses' => [['question' => 'question_alias', 'operator' => 'is', 'values' => ['question_alias']]]];
        foreach ([2, 3] as $version) {
            $tree = ['v' => $version, 'submissions' => [['id' => 'question_alias', 'required' => true, 'fields' => [], 'consents' => []]], 'steps' => [
                ['id' => 'question_alias', 'name' => 'Choose', 'kind' => 'input', 'content' => ['type' => 'question', 'id' => 'question_alias',
                    'label' => 'Which?', 'answer_type' => 'single', 'options' => [['value' => 'question_alias', 'label' => 'Same spelling']]]],
                ['id' => 'follow', 'name' => 'Follow-up', 'kind' => 'input', 'when' => $when, 'content' => ['type' => 'heading', 'text' => 'Details']],
                ['id' => 'result', 'name' => 'Result', 'kind' => 'result', 'results' => [
                    ['id' => 'question_alias', 'when' => $when, 'heading' => 'Match', 'body' => ''], ['id' => 'fallback', 'heading' => 'Fallback', 'body' => ''],
                ], 'content' => ['type' => 'heading', 'text' => 'Result']],
            ]];
            if ($version === 3) $tree['graph'] = ['entry' => 'question_alias', 'edges' => [
                ['id' => 'question_alias', 'from' => 'question_alias', 'to' => 'follow', 'kind' => 'answer', 'when' => $when],
            ]];
            else $tree['steps'][0]['paths'] = [['to' => 'follow', 'when' => $when]];
            $normalized = self::normalize(['tree' => $tree])['tree'];
            $id = $normalized['steps'][0]['content']['id'];
            self::assertNotSame('question_alias', $id);
            self::assertSame($id, $normalized['steps'][1]['when']['clauses'][0]['question']);
            self::assertSame($id, $normalized['steps'][2]['results'][0]['when']['clauses'][0]['question']);
            self::assertSame('question_alias', $normalized['steps'][0]['id']);
            self::assertSame('question_alias', $normalized['steps'][0]['content']['options'][0]['value']);
            self::assertSame('question_alias', $normalized['submissions'][0]['id']);
            self::assertSame('question_alias', $normalized['steps'][2]['results'][0]['id']);
            $route = $version === 3 ? $normalized['graph']['edges'][0] : $normalized['steps'][0]['paths'][0];
            self::assertSame($id, $route['when']['clauses'][0]['question']);
            self::assertSame(['question_alias'], $route['when']['clauses'][0]['values']);
            if ($version === 3) {
                self::assertSame('question_alias', $normalized['graph']['entry']);
                self::assertSame('question_alias', $route['id']);
                self::assertSame('question_alias', $route['from']);
            }
            self::assertSame($normalized, self::normalize(['tree' => $normalized])['tree']);
        }
    }

    public function testGraphDraftKeepsStableEdgesAndPriorityWithoutUnknownKeys(): void
    {
        $fixture = json_decode((string) file_get_contents(self::PLUGIN_DIR . '/tests/fixtures/journey-graph.json'), true);
        $tree = ['v' => 3, 'steps' => $fixture['steps'], 'submissions' => [], 'graph' => $fixture['graph']];
        $tree['graph']['edges'][0]['onclick'] = 'not-a-route-setting';
        $normalized = self::normalize(['tree' => $tree])['tree'];
        if (!isset($normalized['graph'])) { self::fail('A version 3 journey must retain its graph.'); }
        self::assertSame(3, $normalized['v']);
        self::assertSame('interests', $normalized['graph']['entry']);
        self::assertSame(array_column($fixture['graph']['edges'], 'id'), array_column($normalized['graph']['edges'], 'id'));
        self::assertArrayNotHasKey('onclick', $normalized['graph']['edges'][0]);
        $withoutCopy = self::vocabulary()->withoutCopy($normalized);
        if (!isset($withoutCopy['graph'])) { self::fail('Removing copy must retain the graph.'); }
        self::assertSame($normalized['graph'], $withoutCopy['graph']);
        self::assertNull(\WConvert\Template\JourneyGraph::issue($normalized));
        self::assertSame('navigation', \WConvert\Template\CaptureContract::issue(['template' => ['tree' => $normalized]], 'collect_enquiries', ''));
    }

    public function testAnUnknownNodeTypeIsDropped(): void
    {
        $normalized = self::normalize([
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'stack',
                'children' => [
                    ['type' => 'heading', 'text' => 'Join'],
                    ['type' => 'carousel', 'slides' => 4],
                ],
            ]]]),
        ]);

        $this->assertSame(
            [['type' => 'heading', 'text' => 'Join', 'id' => 'n1']],
            $normalized['tree']['steps'][0]['content']['children']
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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'heading', 'text' => 'Join', 'onclick' => 'alert(1)']]]),
        ]);

        $this->assertSame(['type' => 'heading', 'text' => 'Join', 'id' => 'n1'], $normalized['tree']['steps'][0]['content']);
    }

    public function testAnUnknownSlotRoleIsDroppedButTheNodeSurvives(): void
    {
        $normalized = self::normalize([
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'heading', 'role' => 'shout', 'text' => 'Join']]]),
        ]);

        $this->assertSame(['type' => 'heading', 'text' => 'Join', 'id' => 'n1'], $normalized['tree']['steps'][0]['content']);
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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => 'First'],
                ['type' => 'heading', 'role' => 'headline', 'text' => 'Second'],
            ]]),
        ]);

        $this->assertSame('headline', $normalized['tree']['steps'][0]['content']['role'] ?? null);
        $this->assertSame('headline', $normalized['tree']['steps'][1]['content']['role'] ?? null);
    }

    /**
     * The one place a scheme can arrive from off-site, and the one thing
     * ADR 0013 asks PHP to validate at write.
     */
    public function testALinkHrefIsSchemeValidatedAtWrite(): void
    {
        $link = static fn (string $href): array => [
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'text',
                'text' => 'Our %s',
                'link' => ['label' => 'policy', 'href' => $href],
            ]]]),
        ];

        $kept = self::normalize($link('https://example.test/privacy'));
        $dropped = self::normalize($link('javascript:alert(1)'));

        $this->assertSame('https://example.test/privacy', $kept['tree']['steps'][0]['content']['link']['href']);
        $this->assertArrayNotHasKey('href', $dropped['tree']['steps'][0]['content']['link']);
    }

    public function testTheTwoPanesOfASplitAreValidatedLikeAnyOtherChildren(): void
    {
        $normalized = self::normalize([
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'split',
                'ratio' => 0.4,
                'start' => [['type' => 'image', 'src' => '/x.png', 'alt' => '']],
                'end' => [['type' => 'marquee']],
            ]]]),
        ]);

        $this->assertCount(1, $normalized['tree']['steps'][0]['content']['start']);
        $this->assertSame([], $normalized['tree']['steps'][0]['content']['end']);
        $this->assertSame(0.4, $normalized['tree']['steps'][0]['content']['ratio']);
    }

    public function testATemplateThatIsNotATemplateNormalisesToAnEmptyOne(): void
    {
        // Both keys always present, including empty, AND the version stamp: a
        // tree with no `v` is one written before the key existed, which is a
        // fact a migration would need and cannot reconstruct
        // ({@see \WConvert\Template\TemplateTree::VERSION}).
        $empty = ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['v' => TemplateTree::VERSION, 'steps' => []]), 'tokens' => []];

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
        $tree = \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'stack',
            'children' => [['type' => 'heading', 'role' => 'headline', 'text' => 'Join']],
        ]]]);

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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'consent', 'role' => 'consent_text', 'text' => 'I agree to the %s.']]]),
        ]);

        $this->assertSame('consent_text', $normalized['tree']['steps'][0]['content']['role'] ?? null);
    }

    /**
     * **A Template does not carry copy.** Whatever placeholder text it has is
     * for the gallery and "is never copied into an Optin" (CONTEXT.md,
     * Template) — that boundary is what keeps the library goal-agnostic and
     * therefore small.
     */
    public function testTakingACopyLeavesEveryWordBehindAndKeepsEverythingElse(): void
    {
        $stripped = self::vocabulary()->withoutCopy(\WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'stack',
            'children' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => 'Get 10% off'],
                ['type' => 'field', 'name' => 'email', 'label' => 'Email', 'placeholder' => 'you@x.test', 'required' => true],
                ['type' => 'image', 'src' => '/tote.png', 'alt' => 'A tote bag', 'id' => 'n3'],
                ['type' => 'text', 'role' => 'fine_print', 'text' => 'Our %s', 'link' => ['label' => 'policy']],
            ],
        ]]]));

        [$heading, $field, $image, $fine] = $stripped['steps'][0]['content']['children'];

        // The words go.
        $this->assertSame(['type' => 'heading', 'role' => 'headline', 'id' => 'n1'], $heading);
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
        $this->assertSame(['type' => 'image', 'src' => '/tote.png', 'alt' => 'A tote bag', 'id' => 'n3'], $image);
    }

    public function testPhoneSettingsOnlySurviveOnPhoneFieldsWithSupportedValues(): void
    {
        $normalized = self::normalize(['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'stack', 'children' => [
                ['type' => 'field', 'name' => 'phone', 'phone_country' => 'OM', 'phone_dropdown' => false],
                ['type' => 'field', 'name' => 'email', 'phone_country' => 'US', 'phone_dropdown' => false],
                ['type' => 'field', 'name' => 'phone', 'phone_country' => 'ZZ', 'phone_dropdown' => 'false'],
            ],
        ]]])]);
        [$phone, $email, $invalid] = $normalized['tree']['steps'][0]['content']['children'];
        $this->assertSame('OM', $phone['phone_country']);
        $this->assertFalse($phone['phone_dropdown']);
        $this->assertArrayNotHasKey('phone_country', $email);
        $this->assertArrayNotHasKey('phone_dropdown', $email);
        $this->assertArrayNotHasKey('phone_country', $invalid);
        $this->assertArrayNotHasKey('phone_dropdown', $invalid);
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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'stack',
                'children' => [
                    ['type' => 'heading', 'text' => 'Join', 'hidden' => true],
                    ['type' => 'text', 'text' => 'Fine print', 'hidden' => true],
                    ['type' => 'image', 'src' => '/x.png', 'hidden' => true],
                    ['type' => 'consent', 'text' => 'Email me', 'hidden' => true],
                    ['type' => 'field', 'name' => 'email', 'hidden' => true],
                    ['type' => 'button', 'label' => 'Join', 'action' => 'submit', 'hidden' => true],
                ],
            ]]]),
        ]);

        $children = $normalized['tree']['steps'][0]['content']['children'];

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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'stack',
                'tokens' => ['bg' => '#fff4df', 'wobble' => '3deg', '--evil' => 'x'],
                'children' => [],
            ]]]),
        ]);

        $this->assertSame(['bg' => '#fff4df'], $normalized['tree']['steps'][0]['content']['tokens']);
    }

    /**
     * And a value that is not a scalar has no spelling as a custom property at
     * all, so a nested structure is refused rather than flattened into one.
     */
    public function testAScopedTokenValueThatIsNotAScalarIsDropped(): void
    {
        $normalized = self::normalize([
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'stack',
                'tokens' => ['bg' => ['#fff', 'url(javascript:alert(1))'], 'fg' => '#331e17'],
                'children' => [],
            ]]]),
        ]);

        $this->assertSame(['fg' => '#331e17'], $normalized['tree']['steps'][0]['content']['tokens']);
    }

    /**
     * A bag that survives to nothing leaves no key behind, so a design that
     * spelled one wrong is byte-identical to one that never spelled it — the
     * same equality the renderer's absent-versus-default cases turn on.
     */
    public function testABagThatKeepsNothingLeavesNoKey(): void
    {
        $normalized = self::normalize([
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'row', 'tokens' => ['wobble' => '3deg'], 'children' => []]]]),
        ]);

        $this->assertArrayNotHasKey('tokens', $normalized['tree']['steps'][0]['content']);
    }

    /**
     * Layouts and leaves share the same closed token vocabulary.
     */
    public function testLayoutsAndLeavesMayCarryClosedBags(): void
    {
        $normalized = self::normalize([
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'stack',
                'tokens' => ['bg' => '#111'],
                'children' => [
                    ['type' => 'row', 'tokens' => ['bg' => '#222'], 'children' => []],
                    ['type' => 'grid', 'tokens' => ['bg' => '#333'], 'children' => []],
                    ['type' => 'split', 'tokens' => ['bg' => '#444'], 'start' => [], 'end' => []],
                    ['type' => 'heading', 'text' => 'Join', 'tokens' => ['fg' => '#555', 'wobble' => '3deg'], 'narrow' => ['heading-size' => '2rem', 'unknown' => 'yes']],
                ],
            ]]]),
        ]);

        $step = $normalized['tree']['steps'][0]['content'];

        $this->assertSame(['bg' => '#111'], $step['tokens']);

        foreach (array_slice($step['children'], 0, 3) as $node) {
            $this->assertArrayHasKey('tokens', $node, sprintf('%s may carry a bag', $node['type']));
        }

        $this->assertSame(['fg' => '#555'], $step['children'][3]['tokens']);
        $this->assertSame(['heading-size' => '2rem'], $step['children'][3]['narrow']);
    }

    /**
     * The words come out with everything else that is not words, because a bag
     * is arrangement rather than copy: a [[Playbook]] fills a headline into a
     * design and never repaints it.
     */
    public function testACopyOfATreeKeepsItsScopedBags(): void
    {
        $stripped = self::vocabulary()->withoutCopy(\WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
            'type' => 'stack',
            'tokens' => ['bg' => '#fff4df'],
            'children' => [['type' => 'heading', 'text' => 'Join']],
        ]]]));

        $this->assertSame(['bg' => '#fff4df'], $stripped['steps'][0]['content']['tokens']);
        $this->assertArrayNotHasKey('text', $stripped['steps'][0]['content']['children'][0]);
    }
}
