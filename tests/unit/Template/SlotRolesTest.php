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
     * @return array<string, mixed>
     */
    private static function tree(array $children): array
    {
        return \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => $children]]]);
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
        $tree = \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
            ['type' => 'split',
                'start' => [['type' => 'heading', 'role' => 'headline', 'text' => 'x']],
                'end' => [['type' => 'text', 'role' => 'fine_print', 'text' => 'y']],
            ],
            ['type' => 'stack', 'children' => [['type' => 'heading', 'role' => 'success_headline', 'text' => 'z']]],
        ]]);

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

        [$heading, $field] = $bound['steps'][0]['content']['children'];

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

        $node = $bound['steps'][0]['content']['children'][0];

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

        $this->assertSame('Hi', $bound['steps'][0]['content']['children'][0]['text']);
        $this->assertCount(1, $bound['steps'][0]['content']['children']);
    }

    /**
     * ==========================================================================
     * REPEATED ROLES: THE THREE-BENEFIT ROW THAT USED TO SHOW ONE BENEFIT.
     * ==========================================================================
     * A Role is claimable by more than one node (ADR 0051), so a Playbook
     * supplying a list fills them in tree order. Before this, the second and
     * third `body` nodes lost their Role at validation, `withoutCopy()` took
     * their words at snapshot, and the visitor saw two empty paragraphs.
     */
    public function testAListOfWordsFillsRepeatedRolesInTreeOrder(): void
    {
        $tree = self::tree([
            ['type' => 'text', 'role' => 'body'],
            ['type' => 'text', 'role' => 'body'],
            ['type' => 'text', 'role' => 'body'],
        ]);

        $bound = SlotRoles::bind(
            $tree,
            ['body' => ['Free shipping', 'Early drops', '48h returns']],
            $this->vocabulary()
        );

        $this->assertSame(
            ['Free shipping', 'Early drops', '48h returns'],
            array_column($bound['steps'][0]['content']['children'], 'text')
        );
    }

    /**
     * **One word does not fill three slots.** A design with more nodes than the
     * Playbook has words leaves the extras empty rather than repeating the
     * first — three benefit lines all reading "Free shipping" is not what a
     * Playbook supplying one line meant, and it is the failure a merchant would
     * never think to report.
     */
    public function testASingleWordFillsOnlyTheFirstOfSeveralNodes(): void
    {
        $tree = self::tree([
            ['type' => 'text', 'role' => 'body'],
            ['type' => 'text', 'role' => 'body'],
        ]);

        $bound = SlotRoles::bind($tree, ['body' => 'Only this one'], $this->vocabulary());

        $this->assertSame('Only this one', $bound['steps'][0]['content']['children'][0]['text']);
        $this->assertArrayNotHasKey('text', $bound['steps'][0]['content']['children'][1]);
    }

    /**
     * And a list longer than the design simply runs out. This is the Template
     * switch the whole seam exists for: a merchant moving from a three-benefit
     * design to a one-benefit one keeps the first and loses the rest, which is
     * what the new design has room to say.
     */
    public function testWordsWithNoSlotToGoInWriteNothing(): void
    {
        $tree = self::tree([['type' => 'text', 'role' => 'body']]);

        $bound = SlotRoles::bind($tree, ['body' => ['First', 'Second']], $this->vocabulary());

        $this->assertSame('First', $bound['steps'][0]['content']['children'][0]['text']);
        $this->assertCount(1, $bound['steps'][0]['content']['children']);
    }

    /**
     * ==========================================================================
     * A LIST IS SEVERAL SLOTS; A MAP IS ONE SLOT WITH SEVERAL KEYS.
     * ==========================================================================
     * Both are PHP arrays and they mean opposite things, which is the one
     * genuinely ambiguous thing repeatable Roles introduce. Being a list settles
     * it exactly rather than by heuristic — a Role filling several keys comes
     * back keyed by those key names, which is never a list.
     */
    public function testASentenceWithALinkIsStillOneSlotAndNotAListOfTwo(): void
    {
        $tree = self::tree([
            ['type' => 'text', 'role' => 'fine_print'],
            ['type' => 'text', 'role' => 'fine_print'],
        ]);

        $bound = SlotRoles::bind($tree, [
            'fine_print' => ['text' => 'See our %s', 'link' => ['label' => 'Privacy Policy']],
        ], $this->vocabulary());

        $this->assertSame('See our %s', $bound['steps'][0]['content']['children'][0]['text']);
        $this->assertArrayNotHasKey('text', $bound['steps'][0]['content']['children'][1]);
    }

    /**
     * The round trip, which is what a Template switch actually runs: read the
     * words off the old design and write them into the new one. A Role claimed
     * ONCE comes back in exactly the shape it always did, so nothing that was
     * already correct changes; claimed twice, it comes back as a list of those
     * same shapes.
     *
     * `heading` has one copy key and comes back as a bare string; `text` has
     * two — its sentence and the link inside it — and comes back as the map of
     * them, which is the shape {@see SlotRoles::bind()} writes back (ADR 0013).
     * That is what makes the list/map distinction exact rather than a guess.
     */
    public function testCopyComesBackAsAListOnlyWhereARoleWasClaimedTwice(): void
    {
        $copy = SlotRoles::copyFrom(
            self::tree([
                ['type' => 'heading', 'role' => 'headline', 'text' => 'One headline'],
                ['type' => 'text', 'role' => 'body', 'text' => 'First'],
                ['type' => 'text', 'role' => 'body', 'text' => 'Second'],
                ['type' => 'text', 'role' => 'fine_print', 'text' => 'Only one of these'],
            ]),
            $this->vocabulary()
        );

        $this->assertSame('One headline', $copy['headline']);
        $this->assertSame(['text' => 'Only one of these'], $copy['fine_print']);
        $this->assertSame([['text' => 'First'], ['text' => 'Second']], $copy['body']);
    }

    /**
     * And it survives the round trip, which is the property the pair exists
     * for: words read off one design land on the same Roles in the next one,
     * in the same order (CONTEXT.md, Playbook).
     */
    public function testWordsSurviveBeingReadOffOneDesignAndBoundIntoAnother(): void
    {
        $vocabulary = $this->vocabulary();
        $written = self::tree([
            ['type' => 'text', 'role' => 'body', 'text' => 'First'],
            ['type' => 'text', 'role' => 'body', 'text' => 'Second'],
        ]);

        // A different design, offering the same two Roles in the same order and
        // carrying no words of its own — which is what a snapshot looks like.
        $bound = SlotRoles::bind(
            \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'row', 'children' => [
                ['type' => 'text', 'role' => 'body'],
                ['type' => 'text', 'role' => 'body'],
            ]]]]),
            SlotRoles::copyFrom($written, $vocabulary),
            $vocabulary
        );

        $this->assertSame(['First', 'Second'], array_column($bound['steps'][0]['content']['children'], 'text'));
    }

    /**
     * ========================================================================
     * THE TWO EDGES WHERE A WRONG "IS THIS A LIST" WOULD DIVERGE.
     * ========================================================================
     * `wordsFor()` spells the test as `$words === array_values($words)` rather
     * than `array_is_list()`, because Plugin Check reads that function against
     * `Requires at least` instead of `Requires PHP` and reports an error on a
     * combination this plugin refuses to run on (#96). The expression is the
     * function exactly, and these are the two cases that would prove otherwise:
     * an empty array is a list, and numeric keys that are not `0, 1, 2 …` in
     * order are not.
     *
     * Without this, a later simplification to something like
     * `isset($words[0])` would pass every other test in this file.
     */
    public function testEmptyWordsAreAListAndFillNothing(): void
    {
        $tree = self::tree([['type' => 'text', 'role' => 'body']]);

        $bound = SlotRoles::bind($tree, ['body' => []], $this->vocabulary());

        $this->assertArrayNotHasKey('text', $bound['steps'][0]['content']['children'][0]);
    }

    /**
     * A map whose keys happen to be numbers is still a map — one slot's words,
     * taken by the first node — because JSON `{"1": …}` decodes to exactly
     * that and a Playbook is JSON.
     */
    public function testNumericKeysOutOfOrderAreAMapAndNotAList(): void
    {
        $tree = self::tree([
            ['type' => 'text', 'role' => 'body'],
            ['type' => 'text', 'role' => 'body'],
        ]);

        $bound = SlotRoles::bind($tree, ['body' => [1 => 'Second only']], $this->vocabulary());

        // **Node 1 is the assertion.** Read as a LIST this would put "Second
        // only" there, because that is what index 1 means; read as a map it
        // goes to the first node as one slot's keys — where `1` names no
        // content key, so nothing is written at all. Both nodes empty is the
        // map reading, and it is the only one either node can produce.
        $this->assertArrayNotHasKey('text', $bound['steps'][0]['content']['children'][0]);
        $this->assertArrayNotHasKey('text', $bound['steps'][0]['content']['children'][1]);
    }
}

