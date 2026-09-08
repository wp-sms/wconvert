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
            /* translators: the small line above a heading, e.g. “LIMITED TIME”. */
            'eyebrow' => __('Line above the heading', 'wconvert'),
            /* translators: the short word on a coloured chip, e.g. “50% OFF”. */
            'badge' => __('Badge wording', 'wconvert'),
            /* translators: the words beside a star rating, e.g. “from 2,000 reviews”. */
            'rating_text' => __('Words beside the stars', 'wconvert'),
            'cta_label' => __('Button label', 'wconvert'),
            'consent_text' => __('Consent wording', 'wconvert'),
            'success_headline' => __('Headline after they submit', 'wconvert'),
            'success_body' => __('Body text after they submit', 'wconvert'),
            /* translators: the discount code shown after a visitor submits, e.g. “WELCOME10”. */
            'code_value' => __('Discount code', 'wconvert'),
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
            /* translators: a block — the small line above a heading, e.g. “LIMITED TIME”. Named for where it sits, because “eyebrow” is a typographer's word. */
            'eyebrow' => __('Overline', 'wconvert'),
            'text' => __('Text', 'wconvert'),
            'badge' => __('Badge', 'wconvert'),
            /* translators: a block — five stars, some of them filled. */
            'rating' => __('Star rating', 'wconvert'),
            'image' => __('Image', 'wconvert'),
            'icon' => __('Icon', 'wconvert'),
            /* translators: a block — a horizontal line separating two parts of a design. */
            'divider' => __('Divider', 'wconvert'),
            /* translators: a block — the time left, ticking down to the date the Optin stops running. */
            'countdown' => __('Countdown', 'wconvert'),
            /* translators: a block — one discount code, boxed, the same for every visitor. */
            'code' => __('Discount code', 'wconvert'),
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
            /* translators: a layout — as many equal columns as fit, wrapping onto the next line. */
            'grid' => __('Equal columns', 'wconvert'),
            /*
             * **Named for what it IS and not for what it does**, which is the
             * opposite of the choice `stack` made one line up. *Column* says
             * what a stack is FOR because every step is already one; a panel is
             * a THING on the screen — a box with its own colour — and the
             * merchant is going to point at it.
             */
            /* translators: a layout — a box with its own background colour, holding other blocks. */
            'panel' => __('Coloured box', 'wconvert'),
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
     * line"* is a definition; *"a field, then its button"* is a picture, and a
     * merchant recognises the thing they were trying to build.
     *
     * **One short line each, and the brevity is the design.** The first version
     * wrote a full sentence with a clause of example, which at a menu's width
     * wrapped to three lines — so ten items became a wall of prose and the note
     * that was meant to help had to be read past to reach the thing being
     * chosen. A note under a menu item is glanced at, not studied.
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
            /*
             * **Column says what it is FOR, not what it looks like.** Every step
             * is already a column, so *"one block under another"* described
             * something the merchant already had and made the menu item read as
             * a no-op — which it is, at the top level. Its real job is grouping,
             * and it is only offered where grouping does something.
             */
            /* translators: what the Column layout is for. It groups blocks so a Row treats them as one item. */
            'stack' => __('Groups blocks into one item.', 'wconvert'),
            /* translators: what the Row layout does. */
            'row' => __('On one line — a field, then its button.', 'wconvert'),
            /* translators: what the Side by side layout does. */
            'split' => __('Two panes — a picture, then the form.', 'wconvert'),
            /*
             * **Named and explained for the WRAPPING**, which is the whole
             * difference from the `grid` that was deleted for not doing it. A
             * merchant reading "Equal columns" has to know it will not hand a
             * phone three 90px columns of prose.
             */
            /* translators: what the Equal columns layout does. */
            'grid' => __('Three across, one per line on a phone.', 'wconvert'),
            /*
             * **The note has to say what makes it different from a Column**,
             * because the two hold their children identically and a merchant
             * reading two menu items called *Column* and *Coloured box* has one
             * question. The answer is the whole feature: this one has its own
             * colour, and everything inside it inherits.
             */
            /* translators: what the Coloured box layout does. */
            'panel' => __('A box with its own colours, holding other blocks.', 'wconvert'),
        ];
    }

    /**
     * What a layout's own setting is called, keyed `"{layout}.{param}"`.
     *
     * **A layout has settings and the editor never offered them.** `split`
     * declares `ratio` and the renderer reads it, and no control in the admin
     * reached it — so a Side by side was a fixed 50/50 forever and the manifest
     * described a capability nobody had. (`grid`'s `columns` was the same, and
     * it is one of the reasons that layout is gone rather than fixed.)
     *
     * Keyed by layout AND param because a param name is only meaningful under
     * its layout: `ratio` means nothing on its own.
     *
     * @return array<string, string>
     */
    public static function layoutParams(): array
    {
        return [
            'split.ratio' => __('How the space is divided', 'wconvert'),
            /*
             * ================================================================
             * FOUR ENTRIES FOR ONE CONTROL, BECAUSE THE KEY IS PER LAYOUT.
             * ================================================================
             * `tokens` is the same bag on every layout and the words are the
             * same words, and it is still spelled four times: this map is keyed
             * `"{layout}.{param}"` because a param name means nothing on its
             * own, and {@see \WConvert\Tests\Unit\Template\TemplateLabelParityTest::testEveryLayoutParamIsNamed()}
             * walks every layout's `params` with no opt-out. A shared entry
             * would be a fifth spelling of "which layouts exist".
             *
             * **It has no `choices`, and that is what makes it a bag rather
             * than an enum.** The block inspector draws a radio group per param
             * that enumerates and skips one that does not, so these words head
             * the Style panel rather than an empty legend.
             */
            /* translators: the colours, spacing and type this box sets for itself and everything inside it. */
            'stack.tokens' => __('Style for this box', 'wconvert'),
            /* translators: the colours, spacing and type this box sets for itself and everything inside it. */
            'row.tokens' => __('Style for this box', 'wconvert'),
            /* translators: the colours, spacing and type this box sets for itself and everything inside it. */
            'split.tokens' => __('Style for this box', 'wconvert'),
            /* translators: the colours, spacing and type this box sets for itself and everything inside it. */
            'grid.tokens' => __('Style for this box', 'wconvert'),
            /* translators: the colours, spacing and type this box sets for itself and everything inside it. */
            'panel.tokens' => __('Style for this box', 'wconvert'),
            /* translators: whether the coloured box has a rule above it, a border all round, or neither. */
            'panel.edges' => __('Border', 'wconvert'),
            /* translators: the least tall the coloured box may be, so a box holding only a picture does not collapse. */
            'panel.min' => __('Least height', 'wconvert'),
        ];
    }

    /**
     * What each OFFERED value of a layout's setting is called, keyed
     * `"{layout}.{param}.{value}"`.
     *
     * **Named for what a merchant SEES, not for the number.** `ratio` is the
     * first pane's share of the line, so `0.35` is a narrow first pane — and
     * *"0.35"* is not a thing to put in front of anybody. The words are
     * directional the way `align`'s are, and the translator resolves them for
     * their own reading direction; the panes themselves are `start` and `end`
     * and never `left` and `right` (ADR 0009).
     *
     * **These are what the panel OFFERS and never what is allowed.** The
     * renderer takes any fraction, so a design shipping `0.4` keeps it — the
     * same bargain token `choices` make.
     *
     * @return array<string, string>
     */
    public static function layoutParamValues(): array
    {
        return [
            /* translators: a side-by-side split. The LOGICAL first pane is narrower — it reads “right” in a right-to-left locale. */
            'split.ratio.0.35' => __('Narrow left', 'wconvert'),
            /* translators: a side-by-side split where both panes are the same width. */
            'split.ratio.0.5' => __('Even', 'wconvert'),
            /* translators: a side-by-side split. The LOGICAL second pane is narrower — it reads “left” in a right-to-left locale. */
            'split.ratio.0.65' => __('Narrow right', 'wconvert'),

            /*
             * ================================================================
             * `block-start` IS LOGICAL, AND THE ENGLISH WORD IS DIRECTIONAL.
             * ================================================================
             * The same bargain `align`'s three values make one section down.
             * The renderer draws `border-block-start`, which is the top of the
             * box in every writing mode this plugin has ever been read in and
             * is the INLINE start of it in a vertical one — so the word here is
             * the one an English reader needs, and the translator resolves it
             * for their own direction. The vocabulary itself never names a
             * physical side (ADR 0009), which is why the stored value is
             * `block-start` and not `top`.
             */
            /* translators: a coloured box with no border at all. */
            'panel.edges.none' => __('None', 'wconvert'),
            /* translators: a border treatment — a thick coloured rule along the block-start edge. In a vertical writing mode this is not the top of the screen. */
            'panel.edges.block-start' => __('A rule above', 'wconvert'),
            /* translators: a border treatment — a thin line all the way round the box. */
            'panel.edges.all' => __('All round', 'wconvert'),

            /*
             * **Named for the JOB and not for the measurement.** `16rem` is not
             * a thing to put in front of anybody, and the three that are not
             * zero are the three heights a picture pane is ever asked for. The
             * renderer takes any length, so a design shipping `18rem` keeps it
             * and the control shows nothing checked — the same bargain every
             * other `choices` list makes.
             */
            /* translators: a minimum height — none, so the box is as tall as what is in it. */
            'panel.min.0' => __('As tall as its contents', 'wconvert'),
            /* translators: a minimum height for a box holding a picture. */
            'panel.min.10rem' => __('Short', 'wconvert'),
            /* translators: a minimum height for a box holding a picture. */
            'panel.min.16rem' => __('Medium', 'wconvert'),
            /* translators: a minimum height for a box holding a picture. */
            'panel.min.24rem' => __('Tall', 'wconvert'),
        ];
    }

    /**
     * What a LEAF's own setting is called, keyed `"{node}.{param}"`.
     *
     * ============================================================================
     * THREE PARAMS THE RENDERER READS AND NO CONTROL EVER REACHED.
     * ============================================================================
     * `heading.level` decides whether a headline is the Optin's `h2` or an `h3`
     * under it, `image.fit` decides whether a picture is cropped or letterboxed,
     * and `field.required` is read by {@see \WConvert\Lead\CaptureForm}, which
     * refuses a submission that left one empty. All three are declared in the
     * manifest, all three are honoured at both ends, and until now the only way
     * to set any of them was to author a [[Template]] by hand — which is exactly
     * the state `split.ratio` was in one level up.
     *
     * ============================================================================
     * KEYED ON `choices`, WHICH IS WHAT SAYS "THIS PARAM HAS A CONTROL".
     * ============================================================================
     * A leaf's `params` list is not the surface: `hidden` is drawn by the
     * inspector's *Show this* switch and `name` and `action` are drawn by the ⇄
     * menu, each of which already has words of its own. A name for those here
     * would be a second word for one control, which is the failure
     * {@see self::keys()} is pinned against one section over.
     *
     * So the manifest's per-node `choices` section is the declaration, exactly as
     * a layout's is, and {@see \WConvert\Tests\Unit\Template\TemplateLabelParityTest}
     * holds these two maps to it in both directions.
     *
     * @return array<string, string>
     */
    public static function nodeParams(): array
    {
        return [
            /*
             * **`level` and `size` are two questions and the label for `level`
             * used to answer both.** It read *"Not its size, which is a token"*,
             * and that was true while a design had one heading size for every
             * heading in it. A design with a display number and a subtitle needs
             * a small `h2` and a large `h3`, which is the pair no token reaches.
             */
            /* translators: a heading's rank inside the Optin — whether it is the main heading or one under it. This is the document outline, not how big it is drawn. */
            'heading.level' => __('Heading rank', 'wconvert'),
            /* translators: how big this heading is drawn, as a step up or down from the design's own heading size. */
            'heading.size' => __('Heading size', 'wconvert'),
            /* translators: how big this paragraph is drawn, as a step up or down from the design's own text size. */
            'text.size' => __('Text size', 'wconvert'),
            /* translators: how a picture fills the space it is given. */
            'image.fit' => __('How the picture fills its space', 'wconvert'),
            /* translators: whether a visitor must fill a form field in before they can submit. */
            'field.required' => __('Must they fill this in?', 'wconvert'),
            /* translators: how many of the five stars are filled in. */
            'rating.value' => __('How many stars', 'wconvert'),
            /* translators: which of the six pictures an Icon block draws. */
            'icon.name' => __('Which picture', 'wconvert'),
            /* translators: whether a picture is a rectangle or a circle. */
            'image.shape' => __('Picture shape', 'wconvert'),
            /* translators: whether a badge sits in the flow of the design or is pinned to its corner. */
            'badge.place' => __('Where the badge sits', 'wconvert'),
        ];
    }

    /**
     * What each OFFERED value of a leaf's setting is called, keyed
     * `"{node}.{param}.{value}"`.
     *
     * **Named for what the merchant sees, never for the stored value.** `1` and
     * `2` are heading ranks, `cover` and `contain` are CSS keywords, and `true`
     * and `false` are not words anybody writes on a form — the same reason
     * `0.35` needed *"Narrow left"*.
     *
     * The values are the manifest's spellings and are compared as VALUES rather
     * than as strings on the way in, so `level` stores the number `1` while the
     * manifest offers `"1"` — see `builder/panel.ts`'s `valueOfChoice`.
     *
     * @return array<string, string>
     */
    public static function nodeParamValues(): array
    {
        return [
            /* translators: a heading rank. This heading is the Optin's own main heading. */
            'heading.level.1' => __('Main heading', 'wconvert'),
            /* translators: a heading rank. This heading sits under the main one. */
            'heading.level.2' => __('Sub-heading', 'wconvert'),

            /*
             * ================================================================
             * ONE SET OF WORDS, SPELLED TWICE, FOR THE SAME REASON `tokens` IS.
             * ================================================================
             * The key is `"{node}.{param}.{value}"` because a param name means
             * nothing on its own, and the parity test walks every node's
             * `choices` with no opt-out. What the duplication buys is the day a
             * heading's steps and a paragraph's steps stop being the same list.
             *
             * **Named for the SIZE and not for the step.** `2xl` is a token in a
             * type scale and not a thing to put in front of anybody; a merchant
             * picking how big a number is drawn is choosing between *Huge* and
             * *Large*. `Normal` is the design's own size and is what a block
             * gets when nothing is chosen, which is why it is named at all
             * rather than left as an empty chip.
             */
            /* translators: a type size step — the largest step — a display number, not a sentence. */
            'heading.size.3xl' => __('Huge', 'wconvert'),
            /* translators: a type size step — a step for a short display line. */
            'heading.size.2xl' => __('Extra large', 'wconvert'),
            /* translators: a type size step — one step up from the design’s own size. */
            'heading.size.xl' => __('Large', 'wconvert'),
            /* translators: a type size step — the design’s own size, which is what a block gets when nothing is chosen. */
            'heading.size.m' => __('Normal', 'wconvert'),
            /* translators: a type size step — one step down from the design’s own size. */
            'heading.size.s' => __('Small', 'wconvert'),
            /* translators: a type size step — the smallest step — fine print. */
            'heading.size.xs' => __('Very small', 'wconvert'),

            /* translators: a type size step — the largest step — a display number, not a sentence. */
            'text.size.3xl' => __('Huge', 'wconvert'),
            /* translators: a type size step — a step for a short display line. */
            'text.size.2xl' => __('Extra large', 'wconvert'),
            /* translators: a type size step — one step up from the design’s own size. */
            'text.size.xl' => __('Large', 'wconvert'),
            /* translators: a type size step — the design’s own size, which is what a block gets when nothing is chosen. */
            'text.size.m' => __('Normal', 'wconvert'),
            /* translators: a type size step — one step down from the design’s own size. */
            'text.size.s' => __('Small', 'wconvert'),
            /* translators: a type size step — the smallest step — fine print. */
            'text.size.xs' => __('Very small', 'wconvert'),


            /* translators: a picture is scaled up until it fills the space, and the overflow is cropped away. */
            'image.fit.cover' => __('Fill the space, cropping', 'wconvert'),
            /* translators: a picture is scaled down until all of it fits, leaving space around it. */
            'image.fit.contain' => __('Fit the whole picture in', 'wconvert'),
            /* translators: a picture keeps the design's own corner rounding. */
            'image.shape.rect' => __('Rectangle', 'wconvert'),
            /* translators: a picture is cropped to a circle — the shape a portrait beside a quote wants. */
            'image.shape.circle' => __('Circle', 'wconvert'),

            /* translators: a badge sits in the flow of the design, above or beside the other blocks. */
            'badge.place.inline' => __('In the design', 'wconvert'),
            /* translators: a badge is pinned over the top corner of the panel, like a price flash. */
            'badge.place.corner' => __('Pinned to the corner', 'wconvert'),

            /* translators: a form field a visitor cannot leave empty. */
            'field.required.true' => __('Required', 'wconvert'),
            /* translators: a form field a visitor may leave empty. */
            'field.required.false' => __('Optional', 'wconvert'),

            /*
             * **Out of five, always, which is why the words say so.** Four
             * stars on their own read as a four-star scale rather than as four
             * out of five, and the second is the claim the design is making.
             * Half stars are not offered: they need a clip path and buy a
             * design nothing.
             */
            /* translators: a star rating. %s is not used; three of five stars are filled. */
            'rating.value.3' => __('Three of five', 'wconvert'),
            /* translators: a star rating — four of five stars are filled. */
            'rating.value.4' => __('Four of five', 'wconvert'),
            /* translators: a star rating — all five stars are filled. */
            'rating.value.5' => __('Five of five', 'wconvert'),

            /*
             * **Named for what a merchant would USE each one for**, not for the
             * shape. "Tick" is a description of a picture; "Tick — a benefit"
             * is the sentence that gets the right icon picked for a benefit
             * list. Six is the closed set, because an open icon slot is a
             * markup slot wearing a hat (`renderer/src/types.ts`).
             */
            /* translators: an icon — a tick, for an item in a list of benefits. */
            'icon.name.check' => __('Tick', 'wconvert'),
            /* translators: an icon — a star, for a review or a rating. */
            'icon.name.star' => __('Star', 'wconvert'),
            /* translators: an icon — a lightning bolt, for speed or an instant delivery. */
            'icon.name.bolt' => __('Lightning', 'wconvert'),
            /* translators: an icon — a wrapped gift, for an offer or a free item. */
            'icon.name.gift' => __('Gift', 'wconvert'),
            /* translators: an icon — a clock, for a deadline. */
            'icon.name.clock' => __('Clock', 'wconvert'),
            /* translators: an icon — a delivery van, for shipping. */
            'icon.name.truck' => __('Delivery van', 'wconvert'),
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
            /* translators: the background colour of a text box a visitor types into. Separate from the design's own background, so a form on a dark panel stays readable. */
            'input-bg' => __('Field background', 'wconvert'),
            'font' => __('Font', 'wconvert'),
            /* translators: a second typeface used only for headings, where the design wants one different from its body text. */
            'heading-font' => __('Heading font', 'wconvert'),
            'heading-size' => __('Heading size', 'wconvert'),
            'heading-weight' => __('Heading weight', 'wconvert'),
            /* translators: the space between letters in a heading. Typographers call it tracking; "letter spacing" is the phrase a merchant knows. */
            'tracking' => __('Heading letter spacing', 'wconvert'),
            'text-size' => __('Text size', 'wconvert'),
            /* translators: the space between lines of text. Typographers call it leading. */
            'leading' => __('Line spacing', 'wconvert'),
            'radius' => __('Corner rounding', 'wconvert'),
            'pad' => __('Inner spacing', 'wconvert'),
            'gap' => __('Space between slots', 'wconvert'),
            'width' => __('Width', 'wconvert'),
            'align' => __('Alignment', 'wconvert'),
            /* translators: a picture behind the whole design. The merchant gives its web address. */
            'bg-image' => __('Background picture', 'wconvert'),
            /* translators: a translucent colour laid over the background picture, so text on top of it stays readable. */
            'overlay' => __('Wash over the picture', 'wconvert'),
            /* translators: the soft shadow under the whole design, which lifts it off the page behind it. */
            'shadow' => __('Shadow', 'wconvert'),
            /* translators: how long the design takes to animate — its entry, and its button on hover. */
            'motion' => __('Animation speed', 'wconvert'),
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

            /*
             * **The same four stacks, spelled a second time, and the duplication
             * is forced rather than lazy.** The key is `"{token}.{value}"`
             * because the value IS the identity, so a shared entry would need a
             * key that names no token — and the parity test walks `choices`
             * per token with no opt-out. What that buys is the thing it costs:
             * the day the heading list and the body list stop being the same
             * list, nothing here has to be untangled.
             */
            /* translators: a font choice — the operating system's own interface typeface. */
            "heading-font.system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" => __('System', 'wconvert'),
            /* translators: a font choice — a typeface with no serifs. */
            "heading-font.'Helvetica Neue', Helvetica, Arial, sans-serif" => __('Sans serif', 'wconvert'),
            /* translators: a font choice — a typeface with serifs. */
            'heading-font.Georgia, \'Times New Roman\', Times, serif' => __('Serif', 'wconvert'),
            /* translators: a font choice — a typeface whose letters are all one width. */
            'heading-font.ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' => __('Monospace', 'wconvert'),

            /*
             * **Named for the weight a reader sees, not for the number.** `600`
             * is not a thing to put in front of anybody, and the CSS numbers
             * are only four of the nine because a system stack has nothing
             * between them to draw — offering `500` on a face that has no
             * medium is offering a chip that changes nothing.
             */
            /* translators: a heading weight — the same thickness as body text. */
            'heading-weight.400' => __('Regular', 'wconvert'),
            /* translators: a heading weight, between regular and bold. */
            'heading-weight.600' => __('Semibold', 'wconvert'),
            /* translators: a heading weight — the usual one for a heading. */
            'heading-weight.700' => __('Bold', 'wconvert'),
            /* translators: the heaviest heading weight offered. */
            'heading-weight.800' => __('Extra bold', 'wconvert'),

            /* translators: heading letters set closer together than normal. */
            'tracking.-0.02em' => __('Tight', 'wconvert'),
            /* translators: heading letters at the typeface's own spacing. */
            'tracking.normal' => __('Normal', 'wconvert'),
            /* translators: heading letters set further apart than normal. */
            'tracking.0.04em' => __('Loose', 'wconvert'),
            /* translators: heading letters set much further apart — the spaced-out look of a label or an eyebrow. */
            'tracking.0.1em' => __('Wide', 'wconvert'),

            /* translators: lines of text set close together. */
            'leading.1.3' => __('Tight', 'wconvert'),
            /* translators: the usual space between lines of text. */
            'leading.1.5' => __('Normal', 'wconvert'),
            /* translators: lines of text set further apart, which reads as airier. */
            'leading.1.7' => __('Airy', 'wconvert'),

            /*
             * **`0ms` is offered, and it is the honest way to turn animation
             * off.** A visitor who asked their system for reduced motion gets
             * none regardless — that is not the merchant's to decide — but a
             * merchant who wants a bar that simply appears should not have to
             * type a unit into a box to get one.
             */
            /* translators: an animation speed — the design appears with no animation at all. */
            'motion.0ms' => __('None', 'wconvert'),
            /* translators: an animation speed. */
            'motion.120ms' => __('Fast', 'wconvert'),
            /* translators: an animation speed — the default. */
            'motion.200ms' => __('Normal', 'wconvert'),
            /* translators: an animation speed. */
            'motion.400ms' => __('Slow', 'wconvert'),

            /*
             * ====================================================================
             * FOUR STRINGS, AND WHAT THEY BUY IS THAT NOBODY TYPES `box-shadow`.
             * ====================================================================
             * `shadow` had no entry here and its value — four components and a
             * colour — is nothing {@see \WConvert\Template\ThemeTokens} or the
             * admin's shape tests can read, so the panel's last branch handed
             * every design a raw text box, permanently
             * ({@see docs/adr/0054-every-control-has-the-shape-of-its-value.md}).
             *
             * Named in the register `motion` and `leading` already use: a word
             * for the AMOUNT of the thing, never for the CSS. The third value is
             * the manifest's own fallback, so a design that declares no shadow
             * opens with *Normal* checked and the common case lands right.
             *
             * **Seven of the nine designs that declare a shadow declare one that
             * is not on this list** — three of them cast upward, because a bar
             * sits at the bottom of the viewport. They open on *Custom* with
             * their own value intact, which is what `choices` means.
             */
            /* translators: a shadow depth — the design casts no shadow at all. */
            'shadow.none' => __('None', 'wconvert'),
            /* translators: a shadow depth — barely there, the design sits almost flat on the page. */
            'shadow.0 1px 2px rgba(0, 0, 0, 0.08)' => __('Soft', 'wconvert'),
            /* translators: a shadow depth — the default. */
            'shadow.0 10px 40px rgba(0, 0, 0, 0.18)' => __('Normal', 'wconvert'),
            /* translators: a shadow depth — the design lifts well off the page behind it. */
            'shadow.0 24px 64px rgba(0, 0, 0, 0.3)' => __('Deep', 'wconvert'),
        ];
    }

    /**
     * What each FACET the picker filters by is called.
     *
     * ============================================================================
     * THE THREE A MERCHANT COMPARING DESIGNS ACTUALLY USES.
     * ============================================================================
     * Six facets are derived from a tree and three of them are offered as
     * controls ({@see TemplateFacets}). These are the names over those three
     * chip strips, and each one has to answer ADR 0042 rule 2 — *does knowing
     * this change what they do next?* — before it earns a line of the toolbar.
     *
     * Named for the QUESTION rather than for the key. `has_image` is *"Picture"*
     * because the strip under it holds one chip and a merchant reads the pair,
     * not the key.
     *
     * @return array<string, string>
     */
    public static function facets(): array
    {
        return [
            /* translators: a filter over the design library — how a design is arranged. */
            'shape' => __('Shape', 'wconvert'),
            /* translators: a filter over the design library — what the design asks a visitor for. */
            'captures' => __('Asks for', 'wconvert'),
            /* translators: a filter over the design library — whether the design has an image in it. */
            'has_image' => __('Picture', 'wconvert'),
        ];
    }

    /**
     * What each OFFERED FACET VALUE is called, keyed `"{facet}.{value}"`.
     *
     * ============================================================================
     * TWO OF THE THREE BORROW WORDS THE ADMIN ALREADY SAYS, DELIBERATELY.
     * ============================================================================
     * A `shape` chip and a row in the structure editor name the same layout, and
     * a `captures` chip and the ⇄ menu name the same field kind. Composing them
     * from {@see self::layouts()} and {@see self::fields()} is what makes that
     * true by construction: a merchant who filtered by *Side by side* and then
     * opened the design finds a block called *Side by side*, and a translator
     * has one string to get right rather than two that must agree.
     *
     * It also removes the failure the other spelling would have: two lists
     * whose keys are checked against the manifest separately can both pass
     * while saying different words for `split`.
     *
     * `has_image` is the exception because it has no vocabulary behind it. It is
     * a boolean, so it offers exactly one chip — the manifest declares `"true"`
     * and this names it — and *"With a picture"* is the phrase, because a chip
     * reading *"True"* is a chip nobody presses.
     *
     * @return array<string, string>
     */
    public static function facetValues(): array
    {
        $values = [];

        foreach (self::layouts() as $layout => $label) {
            $values['shape.' . $layout] = $label;
        }

        foreach (self::fields() as $field => $label) {
            $values['captures.' . $field] = $label;
        }

        /* translators: the one chip under the Picture filter — designs with an image in them. */
        $values['has_image.true'] = __('With a picture', 'wconvert');

        return $values;
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
            'layoutParams' => self::layoutParams(),
            'layoutParamValues' => self::layoutParamValues(),
            'nodeParams' => self::nodeParams(),
            'nodeParamValues' => self::nodeParamValues(),
            'fields' => self::fields(),
            'placeholders' => self::placeholders(),
            'keys' => self::keys(),
            'params' => self::params(),
            'tokens' => self::tokens(),
            'tokenValues' => self::tokenValues(),
            'facets' => self::facets(),
            'facetValues' => self::facetValues(),
        ];
    }
}
