<?php

namespace WConvert\Milestone;

use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * Which of a [[Playbook]]'s suggestions the merchant overrode first — **a
 * closed set of five, with no filter and no registry**.
 *
 * ============================================================================
 * THE FIVE ARE THE FIVE THINGS PREFILL WRITES. THAT IS THE WHOLE DEFINITION.
 * ============================================================================
 * The [[Goal]] and Playbook catalogue is market-derived: 462 listings and 670
 * reviews classified into 25 market Goals and cut down to five first-class
 * ones. That is a decent way to guess and no way at all to know, and **what a
 * merchant changes first is the sharpest available evidence that a Goal's
 * defaults are wrong** (#94).
 *
 * So a "part" is not a region of the config and not a tab of the builder. It
 * is one of the things {@see \WConvert\Playbook\Prefill::fromPlaybook()}
 * actually writes into a new Optin — the Goal, the design, the words, the
 * rules and the targeting — because those are the only things the Playbook
 * ever offered an opinion about, and an override is only evidence where there
 * was an opinion to override.
 *
 * `PrefillPartsParityTest` holds that sentence to the code: every key prefill
 * writes is claimed by exactly one case below, so a Playbook that starts
 * supplying something new cannot quietly become invisible here.
 *
 * ============================================================================
 * WHAT IS DELIBERATELY NOT A PART.
 * ============================================================================
 * - **The name.** A merchant renaming *"Welcome discount"* to *"Spring sale"*
 *   has labelled their own thing, not rejected an idea about converting — and
 *   it is the cheapest edit in the builder, so counting it would let the most
 *   trivial act on the screen swamp the one signal this exists to collect.
 * - **[[Destination]]s.** Prefill **binds none**, on purpose and in as many
 *   words: *"prefill never binds a Destination invisibly"* (CONTEXT.md,
 *   Playbook). The first Destination a merchant binds is them filling a blank
 *   the Playbook left for them, which is the Playbook working rather than
 *   failing.
 * - **[[Frequency]], the [[Schedule]] and `priority`.** Same reason. Prefill
 *   writes none of the three, so there is no suggestion there to change.
 *
 * ============================================================================
 * THE ORDER IS THE TIE-BREAK, BECAUSE ONE SAVE CAN CHANGE SEVERAL.
 * ============================================================================
 * The builder saves the whole draft, so "which was changed first" has no
 * answer inside a single `PUT` that moved three of these at once. The order of
 * the cases below is that answer, and it is **sharpest indictment first**:
 *
 * - {@see self::Goal} says the taxonomy classified this merchant wrong, which
 *   is the strongest statement any of these can make.
 * - {@see self::Design} says the Playbook chose the wrong shape for the job.
 * - {@see self::Rules} and {@see self::Targeting} say it chose the wrong
 *   moment and the wrong pages.
 * - {@see self::Copy} is last because **every merchant changes the words**.
 *   A Playbook's copy is generic by construction, so a first edit that is copy
 *   carries almost no information — and letting it win a tie would hide the
 *   one that did.
 *
 * @since 0.1.0
 */
enum EditedPart: string
{
    /**
     * The [[Goal]] itself, corrected on the Optin.
     *
     * Not a key of `config` at all — a Goal is a column, and it arrives on the
     * request beside it. It is a part anyway, and the sharpest one: every
     * other case says a Playbook was wrong, and this one says the catalogue
     * put the merchant in the wrong drawer to begin with.
     */
    case Goal = 'goal';

    /**
     * The [[Template]] snapshot with its words taken out — structure, tokens,
     * which design, and therefore the [[Display Type]] that follows from it.
     *
     * Read through {@see \WConvert\Template\TemplateVocabulary::withoutCopy()},
     * which is the same strip a snapshot takes, so what counts as "not words"
     * here is decided by the manifest rather than by a second list.
     *
     * An image the merchant uploaded and a button's `href` land here rather
     * than in {@see self::Copy}: they are content and they are not words
     * ({@see \WConvert\Template\MerchantsOwn}), and a merchant who replaced
     * the Playbook's picture has rejected its look.
     */
    case Design = 'design';

    /**
     * The [[Trigger]]s and [[Condition]]s — when it shows and to whom.
     */
    case Rules = 'rules';

    /**
     * Which pages it shows on.
     *
     * A Playbook that supplied none suggested *everywhere*, so a merchant
     * narrowing it is still overriding an answer rather than filling a blank —
     * which is what separates this from the Destination binding above.
     */
    case Targeting = 'targeting';

    /**
     * The words, keyed by [[Slot Role]].
     *
     * Read through {@see \WConvert\Template\SlotRoles::copyFrom()} rather than
     * by diffing the tree, so that switching [[Template]] — which rebinds the
     * same words onto different nodes — is not read as the merchant rewriting
     * them.
     */
    case Copy = 'copy';

    /**
     * The merchant's own words for this part.
     *
     * **In PHP, because `wp i18n make-pot` cannot see a string in the admin
     * bundle** — the same reason a [[Goal]]'s label lives on its enum and
     * travels on the dashboard's payload. It also means the bundle never
     * learns that there are five of these, which is what stops a screen
     * branching on one.
     *
     * They name the builder tab the change was made on rather than the config
     * key it landed in, because that is where a merchant reading this would go
     * looking (ADR 0042: an error names a door that is on this screen).
     */
    public function label(): string
    {
        return match ($this) {
            self::Goal => __('The goal it was created for', 'wconvert'),
            self::Design => __('How it looks', 'wconvert'),
            self::Rules => __('When and to whom it shows', 'wconvert'),
            self::Targeting => __('Which pages it shows on', 'wconvert'),
            self::Copy => __('The words', 'wconvert'),
        };
    }

    /**
     * Which suggestion the merchant overrode, comparing what the Optin holds
     * now against what it held before — or **null where nothing a Playbook
     * suggested has moved**.
     *
     * ========================================================================
     * PURE, AND IT COMPARES CANONICALLY RATHER THAN LITERALLY.
     * ========================================================================
     * The builder sends the whole draft back on every save, and what arrives
     * is a JSON object that has been round-tripped through a browser. So `!==`
     * on two arrays would read a reordered object as an edit and record a
     * first edit on the first save that changed nothing at all. Associative
     * arrays are key-sorted before comparison; **lists are not**, because the
     * order of `rules`, of `steps` and of a repeated [[Slot Role]] all mean
     * something (ADR 0051).
     *
     * ========================================================================
     * THE WORDS ARE READ BY ROLE, NOT BY POSITION IN THE TREE.
     * ========================================================================
     * {@see SlotRoles::copyFrom()} is the inverse of the binder prefill used,
     * so switching [[Template]] — which rebinds the same words onto different
     * nodes — reads as {@see self::Design} and not as the merchant having
     * rewritten anything. Diffing the tree directly would report both, and
     * would report Copy first.
     *
     * A Goal is not a key of `config` — it is a column — so it arrives beside
     * the two configs rather than inside them.
     *
     * @param array<string, mixed> $before The config as the Playbook left it, or as it last stood.
     * @param array<string, mixed> $after The config that has just arrived.
     */
    public static function firstChangedBetween(
        array $before,
        array $after,
        string $goalBefore,
        string $goalAfter,
        TemplateVocabulary $vocabulary
    ): ?self {
        if ($goalBefore !== $goalAfter) {
            return self::Goal;
        }

        // In declaration order, which is the tie-break: a save moving three of
        // these at once is recorded as the sharpest of the three.
        foreach (self::cases() as $part) {
            if ($part === self::Goal) {
                continue;
            }

            if (self::canonical($part->of($before, $vocabulary)) !== self::canonical($part->of($after, $vocabulary))) {
                return $part;
            }
        }

        return null;
    }

    /**
     * What this part of a config IS, extracted so two of them can be compared.
     *
     * **Every key {@see \WConvert\Playbook\Prefill::fromPlaybook()} writes is
     * claimed by exactly one case here**, and `PrefillPartsParityTest` is what
     * holds that true — so a Playbook that starts supplying something new
     * cannot quietly become invisible to this milestone.
     *
     * `playbook_id` is the one key prefill writes that no part claims. It is
     * provenance, it identifies the Playbook this whole record is ABOUT, and a
     * merchant cannot edit it into anything.
     *
     * @param array<string, mixed> $config
     * @return mixed
     */
    private function of(array $config, TemplateVocabulary $vocabulary)
    {
        $tree = $config['template']['tree'] ?? null;

        return match ($this) {
            // Unreachable — a Goal is a column and is compared before the loop
            // reaches here. Spelled anyway, because `match` is exhaustive and
            // a silent arm is how the next case added above gets forgotten.
            self::Goal => null,
            self::Design => [
                'design' => $config['template_id'] ?? null,
                'placement' => $config['display_type'] ?? null,
                'tokens' => $config['template']['tokens'] ?? null,
                'arrangement' => $vocabulary->withoutCopy($tree),
            ],
            self::Rules => $config['rules'] ?? null,
            self::Targeting => $config['targeting'] ?? null,
            self::Copy => SlotRoles::copyFrom($tree, $vocabulary),
        };
    }

    /**
     * The same value with every associative array key-sorted, all the way
     * down.
     *
     * `array_is_list()` is the whole of the distinction: a list is ordered
     * because somebody ordered it, and a map is not.
     *
     * @param mixed $value
     * @return mixed
     */
    private static function canonical($value)
    {
        if (!is_array($value)) {
            return $value;
        }

        $canonical = array_map(static fn ($item) => self::canonical($item), $value);

        if (!array_is_list($canonical)) {
            ksort($canonical);
        }

        return $canonical;
    }
}
