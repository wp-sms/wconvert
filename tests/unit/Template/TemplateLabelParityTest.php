<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\ConvertingAct;
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
