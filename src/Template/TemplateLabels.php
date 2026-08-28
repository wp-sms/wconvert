<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The template vocabulary's WORDS.
 *
 * The same split {@see \WConvert\Rules\RuleLabels} makes, one manifest over,
 * and for the reason ADR 0013 gives: the manifest is one file both runtimes
 * read, and `wp i18n make-pot` cannot see a string inside JSON — so the words
 * come out of it into PHP rather than the data going in.
 *
 * **Which is only needed because the panel now names things.** Until the
 * settings panel existed, a [[Slot Role]] was a key two programs agreed on and
 * nobody read; it is now the heading over a control a merchant fills in, and
 * `success_headline` is not a heading.
 *
 * {@see \WConvert\Tests\Unit\Template\TemplateLabelParityTest} fails in both
 * directions — a vocabulary member with no label, and a label for something
 * the manifest does not declare.
 *
 * @since 0.1.0
 */
final class TemplateLabels
{
    /**
     * What each [[Slot Role]] is called on screen.
     *
     * @return array<string, string>
     */
    public static function roles(): array
    {
        return [
            'headline' => __('Headline', 'wconvert'),
            'body' => __('Body text', 'wconvert'),
            'fine_print' => __('Fine print', 'wconvert'),
            'cta_label' => __('Button label', 'wconvert'),
            'consent_text' => __('Consent wording', 'wconvert'),
            'success_headline' => __('Headline after they submit', 'wconvert'),
            'success_body' => __('Body text after they submit', 'wconvert'),
            'email_label' => __('Email label', 'wconvert'),
            'email_placeholder' => __('Email placeholder', 'wconvert'),
            'name_label' => __('Name label', 'wconvert'),
            'name_placeholder' => __('Name placeholder', 'wconvert'),
            'phone_label' => __('Phone label', 'wconvert'),
            'phone_placeholder' => __('Phone placeholder', 'wconvert'),
        ];
    }

    /**
     * What each leaf is called, for the slots that fill no Role — a `field`,
     * whose Roles are derived from what it captures rather than declared, and
     * an `image`, which holds no words at all.
     *
     * @return array<string, string>
     */
    public static function nodes(): array
    {
        return [
            'heading' => __('Heading', 'wconvert'),
            'text' => __('Text', 'wconvert'),
            'image' => __('Image', 'wconvert'),
            'field' => __('Field', 'wconvert'),
            'button' => __('Button', 'wconvert'),
            'consent' => __('Consent checkbox', 'wconvert'),
        ];
    }

    /**
     * What each layout is called, for the structure editor's rows and its Add
     * menu.
     *
     * **Needed only because arrangement became visible.** Until the structure
     * editor existed a layout was a shape the renderer read and nobody named:
     * the settings panel walks leaves and flattens them, so `stack` never
     * reached a merchant's eyes. A tree that lists what a design is MADE of
     * cannot flatten them — a merchant moving the email field is moving it
     * within the `row` — so each one acquires a name the way a Slot Role did.
     *
     * Named for what the merchant SEES rather than for what the renderer does.
     * `split` is *"Side by side"* and not "Split", because the word a merchant
     * needs is the arrangement they are looking at.
     *
     * @return array<string, string>
     */
    public static function layouts(): array
    {
        return [
            'stack' => __('Column', 'wconvert'),
            'row' => __('Row', 'wconvert'),
            'split' => __('Side by side', 'wconvert'),
            'grid' => __('Grid', 'wconvert'),
        ];
    }

    /**
     * What each layout DOES, in one line with an example.
     *
     * ============================================================================
     * A NAME IS NOT AN EXPLANATION, AND FOUR OF THESE NEEDED ONE.
     * ============================================================================
     * *Column*, *Row*, *Side by side* and *Grid* are the four arrangements the
     * vocabulary offers, and the Add menu offered them as four bare words. Two
     * of them are genuinely hard to tell apart from their names — a Row lays
     * blocks along one line, a Side by side gives each pane its own stack — and
     * the merchant finds out which is which by adding one, looking at the
     * preview, and deleting it again.
     *
     * **The example is the half that teaches.** *"Blocks left to right on one
     * line"* is a definition; *"an email box beside its button"* is a picture,
     * and a merchant recognises the thing they were trying to build.
     *
     * Its own map rather than an entry in {@see self::layouts()}, which is
     * pinned to exactly the manifest's layout NAMES — a sentence in there would
     * be a name, and the block tree prints those on every row.
     *
     * @return array<string, string>
     */
    public static function layoutNotes(): array
    {
        return [
            'stack' => __('Blocks stacked top to bottom — a headline over body text over a button.', 'wconvert'),
            'row' => __('Blocks along one line, wrapping when there is no room — an email box beside its button.', 'wconvert'),
            'split' => __('Two panes, each holding its own blocks — a picture on one side, the form on the other.', 'wconvert'),
            'grid' => __('Equal columns that collapse on a phone — three short selling points across.', 'wconvert'),
        ];
    }

    /**
     * What each field kind captures, in the merchant's words.
     *
     * @return array<string, string>
     */
    public static function fields(): array
    {
        return [
            'email' => __('Email address', 'wconvert'),
            'name' => __('Name', 'wconvert'),
            'phone' => __('Phone number', 'wconvert'),
        ];
    }

    /**
     * The example wording a field of each kind ships with.
     *
     * ============================================================================
     * IT IS A DEFAULT TO COMPARE AGAINST, NOT ONLY ONE TO WRITE.
     * ============================================================================
     * The ⇄ control changes what a field captures, and an email field that
     * becomes a phone field must not keep `you@example.com` in front of the
     * visitor. So the new kind's example is written in — but only where the old
     * kind's was still there, which is the same comparison
     * {@see MerchantsOwn} makes across a Template switch: different from what
     * was shipped means the merchant's, and it stays.
     *
     * A design shipping its own wording — `stacked-signup` says
     * *"+44 7700 900000"* — therefore reads as the merchant's and is kept. That
     * is the safe direction, chosen rather than tolerated: the two are
     * indistinguishable from here, and silently overwriting words somebody
     * wrote is the failure that costs more.
     *
     * Separate from {@see self::keys()}, whose `placeholder` entry names the
     * CONTROL rather than saying what goes in it, and separate from
     * {@see self::fields()}, which is the label rather than the example.
     *
     * @return array<string, string>
     */
    public static function placeholders(): array
    {
        return [
            'email' => __('you@example.com', 'wconvert'),
            'name' => __('Your name', 'wconvert'),
            'phone' => __('+44 7700 900000', 'wconvert'),
        ];
    }

    /**
     * What each editable key on a leaf is called.
     *
     * Keyed by the key alone rather than by `type.key`, because these mean the
     * same thing wherever they appear: a `label` is what is written beside the
     * control, on a field and on a button alike.
     *
     * @return array<string, string>
     */
    public static function keys(): array
    {
        return [
            'text' => __('Text', 'wconvert'),
            'link' => __('Link', 'wconvert'),
            'label' => __('Label', 'wconvert'),
            'placeholder' => __('Placeholder', 'wconvert'),
            'src' => __('Image address', 'wconvert'),
            'alt' => __('Alt text', 'wconvert'),
            'href' => __('Where the button goes', 'wconvert'),
        ];
    }

    /**
     * What each PARAM VALUE a merchant may choose is called.
     *
     * ============================================================================
     * ITS OWN MAP, BECAUSE {@see self::keys()} MUST STAY EXACTLY THE CONTENT KEYS.
     * ============================================================================
     * `keys()` is asserted to be the union of every leaf's `content` list and
     * nothing beyond it — a label for `action` in there would be a control the
     * editor must not offer as words. But a `button`'s `action` is now
     * CHOOSABLE: the ⇄ control changes what a block is, and *"submit"* is not a
     * sentence to put in front of a merchant.
     *
     * So the two vocabularies stay apart. A field's kinds are already named by
     * {@see self::fields()}; what is left is the button's two, and they are
     * anchored to {@see ConvertingAct::action()} so a third act could not
     * arrive unnamed.
     *
     * Named for what the button DOES rather than for the value: `link` is the
     * node's word for a CTA that navigates, and a merchant choosing between
     * "link" and "submit" is being asked to know the vocabulary.
     *
     * @return array<string, string>
     */
    public static function params(): array
    {
        return [
            'submit' => __('Sends the form', 'wconvert'),
            'link' => __('Goes somewhere else', 'wconvert'),
        ];
    }

    /**
     * What each token is called.
     *
     * @return array<string, string>
     */
    public static function tokens(): array
    {
        return [
            'bg' => __('Background', 'wconvert'),
            'fg' => __('Text', 'wconvert'),
            'muted' => __('Quiet text', 'wconvert'),
            'accent' => __('Button', 'wconvert'),
            'accent-fg' => __('Button text', 'wconvert'),
            'border' => __('Borders', 'wconvert'),
            'font' => __('Font', 'wconvert'),
            'heading-size' => __('Heading size', 'wconvert'),
            'text-size' => __('Text size', 'wconvert'),
            'radius' => __('Corner rounding', 'wconvert'),
            'pad' => __('Inner spacing', 'wconvert'),
            'gap' => __('Space between slots', 'wconvert'),
            'width' => __('Width', 'wconvert'),
            'align' => __('Alignment', 'wconvert'),
            'backdrop' => __('Backdrop', 'wconvert'),
        ];
    }

    /**
     * What each OFFERED TOKEN VALUE is called, keyed `"{token}.{value}"`.
     *
     * ============================================================================
     * `choices` IS WHAT THE PANEL OFFERS. IT IS NEVER WHAT IS ALLOWED.
     * ============================================================================
     * Token *names* are checked and their *values are not* — that is what keeps
     * `clamp(20rem, 50vw, 30rem)` expressible for `width` and an asymmetric
     * corner expressible for `radius`, and it is deliberate (ADR 0010). So
     * {@see TemplateVocabulary} does not read `choices` and never will: these
     * words exist because a merchant cannot be asked to type `start` into a text
     * box, not because `start` is the only thing `align` may hold.
     *
     * **Keyed by the value rather than by an id**, because the value IS the
     * identity: `align` holds the CSS keyword the renderer's stylesheet reads,
     * and a font token holds the stack itself. An id would be a second spelling
     * of a thing the manifest already spells once, and the parity test below
     * would have nothing to compare.
     *
     * **The font stacks are byte-identical to the manifest's**, apostrophes and
     * all, and that is the one genuinely fragile join in this file. It is a red
     * build rather than an untranslated chip:
     * {@see \WConvert\Tests\Unit\Template\TemplateLabelParityTest::testEveryTokenChoiceIsNamed()}
     * fails in both directions.
     *
     * @return array<string, string>
     */
    public static function tokenValues(): array
    {
        return [
            /*
             * ====================================================================
             * THESE THREE ARE LOGICAL, AND THE ENGLISH WORDS ARE DIRECTIONAL.
             * ====================================================================
             * The renderer sets `text-align: var(--wc-align, start)`, and `start`
             * and `end` are LOGICAL — under `fa_IR` a design set to `start` reads
             * from the right. So the English word is the one an English reader
             * needs and the translator resolves it for their own direction; that
             * is what the comments below are for, and it is why the panel offers
             * words rather than a mirrored icon it would then have to flip.
             */
            /* translators: a text alignment. This is the LOGICAL start of the line, so it reads “Right” in a right-to-left locale. */
            'align.start' => __('Left', 'wconvert'),
            /* translators: a text alignment. */
            'align.center' => __('Centre', 'wconvert'),
            /* translators: a text alignment. This is the LOGICAL end of the line, so it reads “Left” in a right-to-left locale. */
            'align.end' => __('Right', 'wconvert'),

            /*
             * **Every stack here is system-available**, which is a constraint
             * rather than a preference: ADR 0010 hands the renderer the whole
             * stylesheet and there is no web font to load, so a stack naming a
             * face nobody has renders as a fallback the merchant did not pick —
             * and they would have chosen it by looking at it, because the panel
             * sets each chip in its own face.
             *
             * Named for the REGISTER rather than for a typeface: "Helvetica" on
             * a Windows machine is Arial, and a label that names one face while
             * showing another is a label that lies on most installs.
             */
            /* translators: a font choice — the operating system's own interface typeface. */
            "font.system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" => __('System', 'wconvert'),
            /* translators: a font choice — a typeface with no serifs. */
            "font.'Helvetica Neue', Helvetica, Arial, sans-serif" => __('Sans serif', 'wconvert'),
            /* translators: a font choice — a typeface with serifs. */
            'font.Georgia, \'Times New Roman\', Times, serif' => __('Serif', 'wconvert'),
            /* translators: a font choice — a typeface whose letters are all one width. */
            'font.ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' => __('Monospace', 'wconvert'),
        ];
    }

    /**
     * Every map at once, which is what the gallery route ships.
     *
     * One object rather than five routes: they are read together, once, by one
     * screen, and none of them is a fact about the install.
     *
     * @return array<string, array<string, string>>
     */
    public static function all(): array
    {
        return [
            'roles' => self::roles(),
            'nodes' => self::nodes(),
            'layouts' => self::layouts(),
            'layoutNotes' => self::layoutNotes(),
            'fields' => self::fields(),
            'placeholders' => self::placeholders(),
            'keys' => self::keys(),
            'params' => self::params(),
            'tokens' => self::tokens(),
            'tokenValues' => self::tokenValues(),
        ];
    }
}
