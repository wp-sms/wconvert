<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateFacets;
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

    /**
     * **An author-only [[Slot Role]] is first a Slot Role.**
     *
     * `authored_roles` is what refuses a [[Playbook]] filling `code_value`
     * ({@see \WConvert\Playbook\PlaybookLibrary}), and it is a second list
     * naming members of the first. A name misspelled there refuses nothing and
     * fails nowhere: the intersection is simply always empty, so the Playbook
     * that ships a dead discount code registers cleanly.
     */
    public function testEveryAuthorOnlySlotRoleIsASlotRole(): void
    {
        $manifest = self::manifest();

        /** @var list<string> $authored */
        $authored = $manifest['authored_roles'];
        /** @var list<string> $roles */
        $roles = $manifest['roles'];

        $this->assertNotSame([], $authored, 'the manifest marks no Role author-only, so this asserts nothing');
        $this->assertSame([], array_values(array_diff($authored, $roles)));
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

    /**
     * **A name is not an explanation**, and the Add menu offered four bare
     * words — two of which (Row, Side by side) are genuinely hard to tell apart
     * without one. A layout added to the manifest with no note would arrive in
     * that menu as another bare word, which is the state this exists to end.
     */
    public function testEveryLayoutIsExplained(): void
    {
        /** @var array<string, mixed> $layouts */
        $layouts = self::manifest()['layouts'];

        $this->assertNamesExactly(
            array_map('strval', array_keys($layouts)),
            TemplateLabels::layoutNotes(),
            'layout notes'
        );
    }

    /**
     * **A layout's own settings, which the editor never offered.** `split`
     * declares `ratio`, the renderer reads it, and no control reached it — so a
     * Side by side was a fixed 50/50 and the manifest described a capability
     * nobody had. Both directions, so a param added to the manifest arrives
     * named and a name for a param nothing declares is a dead string.
     */
    public function testEveryLayoutParamIsNamed(): void
    {
        /** @var array<string, array<string, mixed>> $layouts */
        $layouts = self::manifest()['layouts'];
        $declared = [];

        foreach ($layouts as $layout => $entry) {
            foreach ((array) ($entry['params'] ?? []) as $param) {
                $declared[] = $layout . '.' . $param;
            }
        }

        $this->assertNamesExactly($declared, TemplateLabels::layoutParams(), 'layout params');
    }

    /**
     * And every value a layout param OFFERS, for the same reason token choices
     * are named: `0.35` is not a thing to put in front of a merchant.
     */
    public function testEveryLayoutParamChoiceIsNamed(): void
    {
        /** @var array<string, array<string, mixed>> $layouts */
        $layouts = self::manifest()['layouts'];
        $offered = [];

        foreach ($layouts as $layout => $entry) {
            /** @var array<string, list<string>> $choices */
            $choices = (array) ($entry['choices'] ?? []);

            foreach ($choices as $param => $values) {
                foreach ($values as $value) {
                    $offered[] = $layout . '.' . $param . '.' . $value;
                }
            }
        }

        $this->assertNamesExactly($offered, TemplateLabels::layoutParamValues(), 'layout param choices');
    }

    /**
     * ==========================================================================
     * A LEAF HAS SETTINGS TOO, AND THREE OF THEM REACHED NO CONTROL EITHER.
     * ==========================================================================
     * `heading.level`, `image.fit` and `field.required` are declared in the
     * manifest and read by the renderer — `required` is read by the CAPTURE
     * endpoint, which refuses a submission that left one empty — and no control
     * in this admin ever set any of them. Same hole `split.ratio` was in, one
     * level of the vocabulary down.
     *
     * **Keyed on `choices` rather than on `params`, and that is the decision.**
     * A leaf's `params` list also holds `hidden`, `name` and `action`, each of
     * which is already drawn by a control with words of its own — the *Show
     * this* switch and the ⇄ menu. Naming those here would be a second word for
     * one control. So the manifest's per-node `choices` section is what declares
     * "this param has a control", and both directions are asserted: a choice
     * added with no name draws a chip reading `contain`, and a name for a param
     * that offers no choices is a translated string connected to nothing.
     */
    public function testEveryNodeParamWithChoicesIsNamed(): void
    {
        /** @var array<string, array<string, mixed>> $nodes */
        $nodes = self::manifest()['nodes'];
        $declared = [];

        foreach ($nodes as $node => $entry) {
            foreach (array_keys((array) ($entry['choices'] ?? [])) as $param) {
                $declared[] = $node . '.' . $param;
            }
        }

        $this->assertNamesExactly($declared, TemplateLabels::nodeParams(), 'node params');
    }

    /** And every value one of them offers, for the reason `0.35` needed a word. */
    public function testEveryNodeParamChoiceIsNamed(): void
    {
        /** @var array<string, array<string, mixed>> $nodes */
        $nodes = self::manifest()['nodes'];
        $offered = [];

        foreach ($nodes as $node => $entry) {
            /** @var array<string, list<string>> $choices */
            $choices = (array) ($entry['choices'] ?? []);

            foreach ($choices as $param => $values) {
                foreach ($values as $value) {
                    $offered[] = $node . '.' . $param . '.' . $value;
                }
            }
        }

        $this->assertNamesExactly($offered, TemplateLabels::nodeParamValues(), 'node param choices');
    }

    /**
     * A choice for a param the node does not declare would draw a control the
     * vocabulary drops on the way in — offered, translated, and thrown away by
     * {@see \WConvert\Template\TemplateVocabulary}, which keeps only the keys a
     * node's `content` and `params` lists name.
     */
    public function testEveryNodeParamWithChoicesIsAParamThatExists(): void
    {
        /** @var array<string, array<string, mixed>> $nodes */
        $nodes = self::manifest()['nodes'];
        $undeclared = [];

        foreach ($nodes as $node => $entry) {
            $params = array_map('strval', (array) ($entry['params'] ?? []));

            foreach (array_keys((array) ($entry['choices'] ?? [])) as $param) {
                if (!in_array((string) $param, $params, true)) {
                    $undeclared[] = $node . '.' . $param;
                }
            }
        }

        $this->assertSame([], $undeclared, 'every node param with choices is a param the node declares');
    }

    /**
     * ==========================================================================
     * A DEFAULT IS ONE OF THE CHOICES, AND IT IS DECLARED WHEREVER ONE IS.
     * ==========================================================================
     * `defaults` says what the RENDERER does with an absent key, so the block
     * inspector can tick the rank a visitor will actually see rather than
     * leaving a stock heading with neither chip ticked. That the declared value
     * matches the renderer is asserted behaviourally in
     * `tests/js/renderer-manifest-parity.test.ts`; what belongs here is the
     * shape — a default for a param the panel does not offer would be a value
     * no control could ever show, and a default outside its own choice list
     * would tick nothing while claiming to.
     *
     * **Both maps or neither**, per param: a `choices` entry with no default is
     * the state every one of these was in before, which is the state this
     * closed.
     */
    public function testEveryDefaultIsOneOfTheChoicesOffered(): void
    {
        $manifest = self::manifest();
        /** @var array<string, array<string, mixed>> $members */
        $members = array_merge((array) $manifest['nodes'], (array) $manifest['layouts']);
        $withChoices = [];
        $withDefaults = [];

        foreach ($members as $type => $entry) {
            /** @var array<string, list<string>> $choices */
            $choices = (array) ($entry['choices'] ?? []);
            /** @var array<string, string> $defaults */
            $defaults = (array) ($entry['defaults'] ?? []);

            foreach (array_keys($choices) as $param) {
                $withChoices[] = $type . '.' . $param;
            }

            foreach ($defaults as $param => $value) {
                $withDefaults[] = $type . '.' . $param;

                $this->assertContains(
                    $value,
                    $choices[$param] ?? [],
                    sprintf('%s.%s defaults to a value it does not offer', $type, $param)
                );
            }
        }

        sort($withChoices);
        sort($withDefaults);

        $this->assertNotSame([], $withChoices, 'the manifest offers no choices, so this asserts nothing');
        $this->assertSame($withChoices, $withDefaults, 'every offered param declares what absence means');
    }

    public function testEveryTokenIsNamed(): void
    {
        $this->assertNamesExactly(array_map('strval', array_keys(self::manifest()['tokens'])), TemplateLabels::tokens(), 'tokens');
    }

    /**
     * ==========================================================================
     * THE ONE FRAGILE JOIN IN THE VOCABULARY, TURNED INTO A RED BUILD.
     * ==========================================================================
     * `choices` names what the Design panel OFFERS for a token — the three
     * alignments, the four font stacks — and the label key is
     * `"{token}.{value}"`, because the value IS the identity: `align` holds the
     * CSS keyword the renderer reads and a font token holds the stack itself.
     *
     * So four of those keys are whole font stacks, apostrophes included, and a
     * single byte out of step in either file would ship an untranslated chip
     * reading `'Helvetica Neue', Helvetica, Arial, sans-serif` in front of a
     * merchant. This is what makes that a failed build instead.
     *
     * Both directions, like every other method here: a choice added to the
     * manifest with no word for it, and a word for a choice the manifest does
     * not offer.
     *
     * **It asserts nothing about what a token may HOLD.** `choices` is a
     * suggestion and token values stay unvalidated ({@see TemplateVocabulary},
     * which does not read this section), which is what keeps
     * `clamp(20rem, 50vw, 30rem)` typeable.
     */
    public function testEveryTokenChoiceIsNamed(): void
    {
        /** @var array<string, list<string>> $choices */
        $choices = self::manifest()['choices'];
        $offered = [];

        foreach ($choices as $token => $values) {
            foreach ($values as $value) {
                $offered[] = $token . '.' . $value;
            }
        }

        $this->assertNamesExactly($offered, TemplateLabels::tokenValues(), 'token choices');
    }

    /**
     * A choice for a token the manifest does not declare would be a control the
     * panel draws for a token the renderer never reads — offered, translated,
     * and connected to nothing.
     */
    public function testEveryTokenWithChoicesIsATokenThatExists(): void
    {
        $manifest = self::manifest();

        /** @var array<string, list<string>> $choices */
        $choices = $manifest['choices'];
        /** @var array<string, string> $tokens */
        $tokens = $manifest['tokens'];

        $this->assertSame(
            [],
            array_values(array_diff(array_keys($choices), array_keys($tokens))),
            'every token with choices is a token the manifest declares'
        );
    }

    /**
     * ==========================================================================
     * THE ⇄ MENU'S WORDS ARE THEIR OWN MAP, ANCHORED TO THE ENUM.
     * ==========================================================================
     * They cannot live in {@see TemplateLabels::keys()}, which the test below
     * pins to exactly the content keys — a label for `action` in there would be
     * a control the editor must not offer as words.
     *
     * Button actions include navigation as well as conversion. Read the full
     * manifest choice list so Back, Skip and Close cannot fall back to raw keys.
     */
    public function testEveryButtonActionIsNamedAndNothingElseIs(): void
    {
        $this->assertNamesExactly(
            self::manifest()['nodes']['button']['choices']['action'],
            TemplateLabels::params(),
            'button actions'
        );
    }

    /**
     * ==========================================================================
     * THE PICKER'S CHIP STRIP ENUMERATES, SO ITS ENUMERATION IS THE MANIFEST'S.
     * ==========================================================================
     * ADR 0010's rule, applied to the toolbar over a library ten times the size
     * it was: a control that ENUMERATES reads its enumeration from the manifest.
     * The `facets` section says which facets are offered as filters and what
     * each one offers; this is the half that says every one of them has a word.
     *
     * Both directions, like everything else here. A facet added to the manifest
     * with no name draws a chip strip headed `has_image`; a name for a facet the
     * manifest does not offer is a translated string connected to no control.
     */
    public function testEveryOfferedFacetIsNamed(): void
    {
        /** @var array<string, mixed> $facets */
        $facets = self::manifest()['facets'];

        $this->assertNamesExactly(array_map('strval', array_keys($facets)), TemplateLabels::facets(), 'facets');
    }

    /**
     * And every value each one offers, for the reason `0.35` and `start` both
     * needed one: `stack` is not a thing to put in front of a merchant.
     */
    public function testEveryOfferedFacetValueIsNamed(): void
    {
        /** @var array<string, list<string>> $facets */
        $facets = self::manifest()['facets'];
        $offered = [];

        foreach ($facets as $facet => $values) {
            foreach ($values as $value) {
                $offered[] = $facet . '.' . $value;
            }
        }

        $this->assertNamesExactly($offered, TemplateLabels::facetValues(), 'facet values');
    }

    /**
     * ==========================================================================
     * A FACET THE MANIFEST OFFERS IS A FACET THE DERIVATION PRODUCES.
     * ==========================================================================
     * The two halves are written in different languages and different files:
     * `facets` in JSON says what the toolbar draws, and
     * {@see TemplateFacets::FILTERED} says which keys the walk over a tree
     * produces. A facet offered by one and not the other is a chip strip with
     * nothing behind it, or a derived value no control ever shows — and neither
     * fails anywhere else, because both sides are individually consistent.
     */
    public function testEveryOfferedFacetIsOneTheTreeDerivationProduces(): void
    {
        /** @var array<string, mixed> $facets */
        $facets = self::manifest()['facets'];
        $offered = array_map('strval', array_keys($facets));
        $derived = TemplateFacets::FILTERED;

        sort($offered);
        sort($derived);

        $this->assertSame($derived, $offered, 'the manifest and the derivation disagree about which facets filter');
    }

    /**
     * **`shape` and `captures` borrow the vocabulary the admin already speaks**,
     * and this is what holds them to it. A merchant who filtered by *Side by
     * side* opens the design and finds a block called *Side by side*; a `shape`
     * list that drifted from the layouts would break that quietly, because both
     * lists would still be internally valid.
     */
    public function testTheShapeAndCaptureFacetsAreTheVocabularyTheyBorrow(): void
    {
        $manifest = self::manifest();

        /** @var array<string, list<string>> $facets */
        $facets = $manifest['facets'];
        /** @var array<string, mixed> $layouts */
        $layouts = $manifest['layouts'];
        /** @var list<string> $fields */
        $fields = $manifest['fields'];

        $this->assertSame(array_map('strval', array_keys($layouts)), $facets['shape']);
        $this->assertSame($fields, $facets['captures']);
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
