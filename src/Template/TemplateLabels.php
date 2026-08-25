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
            'fields' => self::fields(),
            'keys' => self::keys(),
            'tokens' => self::tokens(),
        ];
    }
}
